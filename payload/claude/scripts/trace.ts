#!/usr/bin/env bun
// trace.ts: read Claude Code session transcripts and count the friction in them.
//
// Why: a weekly retro needs evidence, not recollection. `sessions` shows which sessions hit errors, hook denials,
// interrupts and rejected tool uses; `clusters` groups the error texts that recur across sessions, which is
// the input for deciding what to fix (a hook, a capability note, a line in a CLAUDE.md).
//
// Usage:
//   bun trace.ts sessions [--since 7d] [--json]      one row per session
//   bun trace.ts clusters [--since 30d] [--min 3] [--json]
//                                                    error signatures seen in at least --min sessions
//   --since takes Nd, Nh or Nm (days, hours, minutes); a session counts when its last record falls in the window.
// Transcripts: ~/.claude/projects/<project-dir>/<session>.jsonl and, for subagents,
// ~/.claude/projects/<project-dir>/<session>/subagents/agent-<id>.jsonl (dir: env TRANSCRIPTS_DIR).
// Subagent transcripts carry the parent's sessionId and are folded into the parent session's row.
// Output prints counts and normalized error signatures only, never prompt or message text.
//
// Fields relied on (one JSON object per line; unknown lines and record types are skipped):
//   type                  "user" | "assistant" (others such as "attachment", "system", "summary" are ignored)
//   sessionId             string; falls back to the file stem
//   timestamp             ISO string; min and max per session give start and end
//   message.content       string, or an array of blocks:
//     assistant block     { type: "tool_use", id, name }                       → a tool call (deduplicated by id)
//     user block          { type: "tool_result", tool_use_id, is_error?, content: string | [{type:"text",text}] }
//     user block          { type: "text", text } or a string content starting "[Request interrupted by user"
//                                                                                → a user interrupt
//   permissionDecision    on a user record carrying a tool_result: { decision: "accept"|"reject", source }
//                         reject + source "hook"         → hook denial
//                         reject + source "user_reject"  → rejected tool use
//   Older transcripts lack permissionDecision; then the result text decides: "PreToolUse:<tool> hook ..." is a
//   hook denial, "The user doesn't want to proceed ..." a rejected tool use.
import { parseArgs } from "node:util";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { homedir } from "node:os";

export type Session = {
  session: string;
  project: string;
  start: string;
  end: string;
  subagents: number;
  toolCalls: number;
  toolErrors: number;
  hookDenials: number;
  interrupts: number;
  rejected: number;
  errors: { tool: string; signature: string }[];
};

const isObj = (v: unknown): v is Record<string, any> => v !== null && typeof v === "object" && !Array.isArray(v);
const INTERRUPT = "[Request interrupted by user";
const USER_REJECT = "The user doesn't want to proceed";
const HOOK_TEXT = /^PreToolUse:\S+ hook\b|hook (?:error|blocked|denied)/i;

export function parseSince(s: string): number {
  const m = /^(\d+)([dhm])$/.exec(s.trim());
  if (!m) throw new Error(`--since wants Nd, Nh or Nm, got "${s}"`);
  return Number(m[1]) * { d: 86400000, h: 3600000, m: 60000 }[m[2] as "d" | "h" | "m"];
}

/** Every .jsonl under dir with its project dir (first path segment) and mtime; subagent files included. */
export function transcriptFiles(dir: string, notBefore = 0): { file: string; project: string; subagent: boolean }[] {
  const out: { file: string; project: string; subagent: boolean }[] = [];
  if (!existsSync(dir)) return out;
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl") && statSync(p).mtimeMs >= notBefore) {
        const parts = relative(dir, p).split(sep);
        out.push({ file: p, project: parts.length > 1 ? parts[0]! : "", subagent: parts.includes("subagents") });
      }
    }
  };
  walk(dir);
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter(isObj).map((b) => (typeof b.text === "string" ? b.text : "")).join("\n");
  return "";
}

/** Normalize an error text to a signature: first informative line, numbers, paths, hashes, ids and quotes folded. */
export function signature(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^Exit code \d+$/.test(l));
  const informative = /error|denied|not found|no such|cannot|can't|unable|invalid|timed? ?out|refused|unauthori[sz]ed|forbidden|failed|fatal|blocked|permission/i;
  const line = lines.find((l) => informative.test(l)) ?? lines[0] ?? "(empty)";
  return line
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?/g, "<ts>")
    .replace(/(?:[A-Za-z]+:\/\/|~\/|\.{0,2}\/)[^\s'",;:)\]]+/g, "<path>")
    .replace(/\b(?:0x)?[0-9a-f]{7,}\b/gi, "<hex>")
    .replace(/[A-Za-z0-9_-]{32,}/g, "<tok>")
    .replace(/"[^"]{0,200}"/g, '"<q>"')
    .replace(/'[^']{0,200}'/g, "'<q>'")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

/** Fold the given transcript files into sessions keyed by sessionId. */
export function readSessions(files: { file: string; project: string; subagent: boolean }[]): Session[] {
  const byId = new Map<string, Session & { seen: Set<string>; names: Map<string, string>; done: Set<string> }>();
  for (const { file, project, subagent } of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    let sub: Session | null = null;
    for (const line of text.split("\n")) {
      if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) continue;
      let o: unknown;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (!isObj(o) || (o.type !== "user" && o.type !== "assistant")) continue;
      const id = typeof o.sessionId === "string" ? o.sessionId : basename(file, ".jsonl");
      let s = byId.get(id);
      if (!s) {
        s = { session: id, project, start: "", end: "", subagents: 0, toolCalls: 0, toolErrors: 0, hookDenials: 0, interrupts: 0, rejected: 0, errors: [], seen: new Set(), names: new Map(), done: new Set() };
        byId.set(id, s);
      }
      if (!subagent) s.project = project;
      if (subagent && sub !== s) {
        s.subagents++;
        sub = s;
      }
      if (typeof o.timestamp === "string") {
        if (!s.start || o.timestamp < s.start) s.start = o.timestamp;
        if (o.timestamp > s.end) s.end = o.timestamp;
      }
      const content = isObj(o.message) ? o.message.content : undefined;
      if (typeof content === "string") {
        if (o.type === "user" && content.startsWith(INTERRUPT)) s.interrupts++;
        continue;
      }
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (!isObj(b)) continue;
        if (o.type === "assistant" && b.type === "tool_use" && typeof b.id === "string") {
          if (s.seen.has(b.id)) continue;
          s.seen.add(b.id);
          s.names.set(b.id, typeof b.name === "string" ? b.name : "?");
          s.toolCalls++;
        } else if (o.type === "user" && b.type === "text" && typeof b.text === "string" && b.text.startsWith(INTERRUPT)) {
          s.interrupts++;
        } else if (o.type === "user" && b.type === "tool_result" && typeof b.tool_use_id === "string") {
          if (s.done.has(b.tool_use_id)) continue;
          s.done.add(b.tool_use_id);
          const rt = resultText(b.content);
          const pd = isObj(o.permissionDecision) ? o.permissionDecision : null;
          const rejectedBy = pd?.decision === "reject" ? String(pd.source ?? "") : "";
          const hook = rejectedBy === "hook" || (!pd && b.is_error === true && HOOK_TEXT.test(rt.slice(0, 200)));
          const userReject = rejectedBy === "user_reject" || rt.startsWith(USER_REJECT);
          if (hook) s.hookDenials++;
          if (userReject) s.rejected++;
          if (b.is_error === true || rejectedBy) {
            s.toolErrors++;
            if (!userReject) s.errors.push({ tool: s.names.get(b.tool_use_id) ?? "?", signature: (hook ? "hook: " : "") + signature(rt) });
          }
        }
      }
    }
  }
  return [...byId.values()]
    .map(({ seen: _s, names: _n, done: _d, ...rest }) => rest)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export type Cluster = { tool: string; signature: string; count: number; sessions: number };

export function clusters(sessions: Session[], min: number): Cluster[] {
  const m = new Map<string, { tool: string; signature: string; count: number; ids: Set<string> }>();
  for (const s of sessions)
    for (const e of s.errors) {
      const key = `${e.tool}\t${e.signature}`;
      const c = m.get(key) ?? { tool: e.tool, signature: e.signature, count: 0, ids: new Set<string>() };
      c.count++;
      c.ids.add(s.session);
      m.set(key, c);
    }
  return [...m.values()]
    .map(({ ids, ...c }) => ({ ...c, sessions: ids.size }))
    .filter((c) => c.sessions >= min)
    .sort((a, b) => b.sessions - a.sessions || b.count - a.count || a.signature.localeCompare(b.signature));
}

export function load(dir: string, sinceMs: number, now = Date.now()): Session[] {
  const cutoff = now - sinceMs;
  const cutoffIso = new Date(cutoff).toISOString();
  return readSessions(transcriptFiles(dir, cutoff)).filter((s) => s.end >= cutoffIso);
}

const COLS = ["start", "tools", "errors", "hook", "intr", "rej", "subs", "project"] as const;

export function renderSessions(sessions: Session[]): string {
  const rows = sessions.map((s) => [s.start.slice(0, 16).replace("T", " "), s.toolCalls, s.toolErrors, s.hookDenials, s.interrupts, s.rejected, s.subagents, s.project].map(String));
  const all = [[...COLS], ...rows];
  const w = COLS.map((_, i) => Math.max(...all.map((r) => r[i]!.length)));
  const sum = (k: keyof Session) => sessions.reduce((a, s) => a + (s[k] as number), 0);
  return [
    ...all.map((r) => r.map((x, i) => (i === r.length - 1 ? x : x.padEnd(w[i]!))).join("  ")),
    `# ${sessions.length} sessions, ${sum("toolCalls")} tool calls, ${sum("toolErrors")} errors, ${sum("hookDenials")} hook denials, ${sum("interrupts")} interrupts, ${sum("rejected")} rejected`,
  ].join("\n");
}

export function renderClusters(cs: Cluster[], min: number): string {
  return [...cs.map((c) => `${String(c.sessions).padStart(4)} sess ${String(c.count).padStart(5)}x  ${c.tool}  ${c.signature}`), `# ${cs.length} signatures in ${min}+ sessions`].join("\n");
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { since: { type: "string" }, json: { type: "boolean", default: false }, min: { type: "string", default: "3" } },
  });
  const dir = process.env.TRANSCRIPTS_DIR || join(homedir(), ".claude", "projects");
  const cmd = positionals[0];
  if (cmd === "sessions") {
    const s = load(dir, parseSince(values.since ?? "7d"));
    console.log(values.json ? JSON.stringify(s.map(({ errors: _e, ...r }) => r), null, 1) : renderSessions(s));
  } else if (cmd === "clusters") {
    const min = Number(values.min);
    const cs = clusters(load(dir, parseSince(values.since ?? "30d")), min);
    console.log(values.json ? JSON.stringify(cs, null, 1) : renderClusters(cs, min));
  } else {
    console.error("usage: trace.ts sessions [--since 7d] [--json] | clusters [--since 30d] [--min 3] [--json]");
    process.exit(2);
  }
}
