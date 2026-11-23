#!/usr/bin/env bun
// doctor.ts: run every capability's `health` line and report which services an agent can reach right now.
//
// Why: sessions that build on a service whose access broke silently (an expired token, a moved host) find out
// several steps later. One run at session start (hooks/session-start-doctor.sh calls `--red-only`) names them first.
//
// Reads the frontmatter of ~/.claude/capabilities/*.md (dir: env CAPABILITIES_DIR); keys used: service, health,
// status, verified. _TEMPLATE.md and README.md are skipped. A file with `status: planned`, no `health`, or a
// health line still holding a <<PLACEHOLDER>> is reported as `planned` and not run.
// Each health line runs under `zsh -c` (else `sh -c`) with a 5 s timeout, all in parallel; exit 0 = green.
// Results are cached 10 minutes in os.tmpdir(); the cache is keyed on the directory and every file's mtime,
// so editing a capability invalidates it. --fresh ignores the cache.
//
// Usage: bun doctor.ts [--red-only] [--json] [--fresh]
//   (default)   a table: state, service, verified, detail; then a count line
//   --red-only  one line per failing service, nothing when all pass (the SessionStart hook interface)
//   --json      the rows as JSON
// Always exits 0.
import { parseArgs } from "node:util";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";

export const TIMEOUT_MS = 5000;
export const TTL_MS = 10 * 60 * 1000;
const SKIP = new Set(["_TEMPLATE.md", "README.md"]);

export type Cap = { file: string; service: string; health: string; status: string; verified: string };
export type Row = { service: string; state: "green" | "red" | "planned"; verified: string; detail: string; file: string };

export function parseCap(file: string, text: string): Cap | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s?(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2]!.trim();
    // A trailing YAML comment is only stripped from unquoted values that are not a shell line.
    if (kv[1] !== "health") v = v.replace(/\s+#.*$/, "");
    fm[kv[1]!] = v.replace(/^(['"])(.*)\1$/, "$2");
  }
  return { file, service: fm.service || file.replace(/^.*\//, "").replace(/\.md$/, ""), health: fm.health ?? "", status: fm.status ?? "", verified: fm.verified ?? "" };
}

export function readCaps(dir: string): Cap[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !SKIP.has(f))
    .sort()
    .map((f) => parseCap(join(dir, f), readFileSync(join(dir, f), "utf8")))
    .filter((c): c is Cap => c !== null);
}

const shell = () => (existsSync("/bin/zsh") ? "/bin/zsh" : "/bin/sh");
const oneLine = (s: string) => Array.from(s.trim().replace(/\s*\n\s*/g, " | ")).slice(0, 140).join("");

export async function runHealth(cap: Cap, timeoutMs = TIMEOUT_MS): Promise<Row> {
  const base = { service: cap.service, verified: cap.verified, file: cap.file };
  if (cap.status === "planned" || !cap.health || cap.health.includes("<<")) return { ...base, state: "planned", detail: "" };
  const proc = Bun.spawn([shell(), "-c", cap.health], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  const output = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const code = await proc.exited;
  clearTimeout(timer);
  if (timedOut) return { ...base, state: "red", detail: `timeout after ${timeoutMs / 1000}s` };
  // A background child of the health line can hold the pipes open after the shell exits: stop reading after 500 ms.
  const [out, err] = await Promise.race([output, new Promise<[string, string]>((r) => setTimeout(() => r(["", ""]), 500))]);
  const detail = oneLine(out + "\n" + err);
  return code === 0 ? { ...base, state: "green", detail } : { ...base, state: "red", detail: `exit ${code}${detail ? ": " + detail : ""}` };
}

export function cacheKey(dir: string, caps: Cap[]): string {
  const parts = caps.map((c) => `${c.file}:${statSync(c.file).mtimeMs}`);
  return Bun.hash(dir + "\n" + parts.join("\n")).toString(36);
}

export async function check(dir: string, fresh = false, now = Date.now()): Promise<Row[]> {
  const caps = readCaps(dir);
  const cacheFile = join(tmpdir(), `claude-doctor-${cacheKey(dir, caps)}.json`);
  if (!fresh && existsSync(cacheFile)) {
    try {
      const c = JSON.parse(readFileSync(cacheFile, "utf8"));
      if (now - c.ts < TTL_MS && Array.isArray(c.rows)) return c.rows;
    } catch {}
  }
  const rows = await Promise.all(caps.map((c) => runHealth(c)));
  try {
    writeFileSync(cacheFile, JSON.stringify({ ts: now, rows }));
  } catch {}
  return rows;
}

const ICON: Record<Row["state"], string> = { green: "ok ", red: "RED", planned: "-- " };

export function render(rows: Row[], redOnly: boolean): string {
  const red = rows.filter((r) => r.state === "red");
  if (redOnly) return red.map((r) => `${r.service}: ${r.detail}`).join("\n");
  const w = Math.max(7, ...rows.map((r) => Array.from(r.service).length));
  const lines = rows.map((r) => `${ICON[r.state]}  ${r.service.padEnd(w)}  ${(r.verified || "-").padEnd(10)}  ${r.detail}`);
  const n = (s: Row["state"]) => rows.filter((r) => r.state === s).length;
  return [...lines, `${n("green")} green, ${n("red")} red, ${n("planned")} planned`].join("\n");
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      options: { "red-only": { type: "boolean", default: false }, json: { type: "boolean", default: false }, fresh: { type: "boolean", default: false } },
    });
    const dir = process.env.CAPABILITIES_DIR || join(homedir(), ".claude", "capabilities");
    const rows = await check(dir, values.fresh);
    const out = values.json ? JSON.stringify(rows, null, 1) : render(rows, values["red-only"]!);
    if (out) console.log(out);
  } catch (e) {
    if (!process.argv.includes("--red-only")) console.log(`doctor: not run (${(e as Error).message})`);
  }
  process.exit(0);
}
