#!/usr/bin/env bun
// vault-lint.ts: report where the vault drifted from its contract (Constitution/vault-schema.md). Report-only, exit 0.
//
// Why: agents read handoffs, trackers and decision notes as ground truth. A stale handoff, a task outside a
// tracker or a standing decision that was overruled misleads the next session silently; this makes it visible.
//
// Checks:
//   stale-handoff     Projects/<P>/handoff.md whose `updated` is missing or older than 14 days
//   long-handoff      handoff with more than 40 visible non-empty lines (frontmatter and collapsed callouts excluded)
//   stray-task        open task (`- [ ]`) outside a tracker.md or Timeline/ daily note (code fences and Templates/ ignored)
//   undated-artifact  Projects/<P>/ note without YYYY-MM-DD in its filename (entry note, tracker, tracker-archive,
//                     handoff, decisions exempt)
//   decision          decision note missing type, project, date, title, status or summary; a `supersedes` link to no
//                     note; a `standing` note that another note supersedes
//   forbidden-name    a STATUS, TASKS or BACKLOG file
//   uncommitted       changed paths from `git status --porcelain`, when the vault is a git repo
//
// Usage: bun vault-lint.ts [--summary] [--json] [--today YYYY-MM-DD]
// Vault root: env VAULT_ROOT, else ~/.claude/scripts/config.json (see config.ts).
import { parseArgs } from "node:util";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { localToday, vaultRoot } from "./config.ts";

export const HANDOFF_DAYS = 14;
export const HANDOFF_LINES = 40;
const DECISION_KEYS = ["type", "project", "date", "title", "status", "summary"];
const SKIP_DIRS = new Set([".git", ".obsidian", ".trash", "node_modules"]);
const EXEMPT_ARTIFACTS = new Set(["tracker", "tracker-archive", "handoff", "decisions"]);

export type Finding = { check: string; file: string; detail: string };
export type Report = { findings: Finding[]; uncommitted: number | null };

export function mdFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) mdFiles(p, out);
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

/** Frontmatter as key → raw value; a block list (`key:` then `  - x` lines) is joined with newlines. */
export function frontmatter(text: string): Record<string, string> | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!m) return null;
  const fm: Record<string, string> = {};
  let last: string | null = null;
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) {
      last = kv[1]!;
      fm[last] = kv[2]!.trim();
    } else if (last && /^\s+-\s*/.test(line)) fm[last] = (fm[last] ? fm[last] + "\n" : "") + line.trim();
  }
  return fm;
}

const unquote = (v: string) => v.replace(/^(['"])(.*)\1$/, "$2").trim();
const links = (v: string | undefined) => [...(v ?? "").matchAll(/\[\[([^\]|#]+)/g)].map((m) => basename(m[1]!.trim()).replace(/\.md$/, ""));
const dayNumber = (iso: string) => Date.parse(iso + "T00:00:00Z") / 86400000;

/** Non-empty lines outside frontmatter and collapsed callouts (`> [!type]-` and the `>` lines under it). */
export function visibleLines(text: string): number {
  const all = text.split(/\r?\n/);
  let start = 0;
  if (all[0]?.trim() === "---") {
    const end = all.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end > 0) start = end + 1;
  }
  let n = 0;
  let collapsed = false;
  for (const l of all.slice(start)) {
    if (/^>\s*\[![\w-]+\]-/.test(l)) {
      collapsed = true;
      continue;
    }
    if (collapsed && l.startsWith(">")) continue;
    collapsed = false;
    if (l.trim()) n++;
  }
  return n;
}

/** 1-based line numbers of open tasks, skipping fenced code blocks. */
export function openTaskLines(text: string): number[] {
  const out: number[] = [];
  let fence: string | null = null;
  text.split(/\r?\n/).forEach((l, i) => {
    const f = /^\s*(`{3,}|~{3,})/.exec(l);
    if (f) {
      if (fence === null) fence = f[1]![0]!;
      else if (f[1]![0] === fence) fence = null;
      return;
    }
    if (fence === null && /^\s*[-*] \[ \] /.test(l)) out.push(i + 1);
  });
  return out;
}

function projectDirs(vault: string): string[] {
  const root = join(vault, "Projects");
  if (!existsSync(root)) return [];
  return readdirSync(root).sort().map((p) => join(root, p)).filter((p) => statSync(p).isDirectory());
}

export function uncommittedCount(vault: string): number | null {
  if (!existsSync(join(vault, ".git"))) return null;
  const r = Bun.spawnSync(["git", "-C", vault, "status", "--porcelain", "--untracked-files=all"], { stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) return null;
  return r.stdout.toString().split("\n").filter((l) => l.trim()).length;
}

export function lint(vault: string, today: string): Report {
  const findings: Finding[] = [];
  const add = (check: string, abs: string, detail: string) => findings.push({ check, file: relative(vault, abs), detail });
  const files = mdFiles(vault);
  const bases = new Set(files.map((f) => basename(f, ".md")));

  for (const dir of projectDirs(vault)) {
    const handoff = join(dir, "handoff.md");
    if (existsSync(handoff)) {
      const text = readFileSync(handoff, "utf8");
      const updated = unquote(frontmatter(text)?.updated ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) add("stale-handoff", handoff, "no `updated` date");
      else {
        const age = Math.round(dayNumber(today) - dayNumber(updated));
        if (age > HANDOFF_DAYS) add("stale-handoff", handoff, `updated ${updated}, ${age} days ago`);
      }
      const n = visibleLines(text);
      if (n > HANDOFF_LINES) add("long-handoff", handoff, `${n} visible lines (max ${HANDOFF_LINES})`);
    }
    const entry = basename(dir);
    for (const f of mdFiles(dir)) {
      const base = basename(f, ".md");
      if (base === entry || EXEMPT_ARTIFACTS.has(base)) continue;
      if (!/\d{4}-\d{2}-\d{2}/.test(base)) add("undated-artifact", f, "filename has no YYYY-MM-DD");
    }
  }

  for (const f of files) {
    const rel = relative(vault, f);
    if (rel.startsWith("Templates/")) continue;
    const isTaskHome = basename(f) === "tracker.md" || rel.startsWith("Timeline/");
    if (!isTaskHome) for (const line of openTaskLines(readFileSync(f, "utf8"))) add("stray-task", f, `open task at line ${line}`);
  }

  const decisions = files.filter((f) => /^Projects\/[^/]+\/decisions\/[^/]+\.md$/.test(relative(vault, f)));
  const notes = decisions.map((f) => ({ f, base: basename(f, ".md"), fm: frontmatter(readFileSync(f, "utf8")) ?? {} }));
  const supersededBy = new Map<string, string>();
  for (const n of notes) {
    const missing = DECISION_KEYS.filter((k) => !unquote(n.fm[k] ?? ""));
    if (missing.length) add("decision", n.f, `missing ${missing.join(", ")}`);
    for (const t of links(n.fm.supersedes)) {
      if (!bases.has(t)) add("decision", n.f, `supersedes [[${t}]], which does not exist`);
      else supersededBy.set(t, n.base);
    }
  }
  for (const n of notes)
    if (unquote(n.fm.status ?? "") === "standing" && supersededBy.has(n.base))
      add("decision", n.f, `status standing, but superseded by ${supersededBy.get(n.base)}`);

  const walk = (dir: string) => {
    for (const e of readdirSync(dir).sort()) {
      if (SKIP_DIRS.has(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/^(STATUS|TASKS|BACKLOG)(\.[\w]+)?$/i.test(e)) add("forbidden-name", p, "STATUS/TASKS/BACKLOG files are not allowed (vault-schema §5)");
    }
  };
  walk(vault);

  return { findings, uncommitted: uncommittedCount(vault) };
}

export function summary(r: Report): string {
  const count = (c: string) => r.findings.filter((f) => f.check === c).length;
  const parts = ["stale-handoff", "long-handoff", "stray-task", "undated-artifact", "decision", "forbidden-name"].map((c) => `${count(c)} ${c}`);
  parts.push(r.uncommitted === null ? "not a git repo" : `${r.uncommitted} uncommitted`);
  return `vault-lint: ${parts.join(", ")}`;
}

export function render(r: Report): string {
  const lines = r.findings.map((f) => `${f.check.padEnd(16)} ${f.file}: ${f.detail}`);
  return [...lines, summary(r)].join("\n");
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      options: { summary: { type: "boolean", default: false }, json: { type: "boolean", default: false }, today: { type: "string", default: localToday() } },
    });
    const report = lint(vaultRoot(), values.today!);
    console.log(values.json ? JSON.stringify(report, null, 1) : values.summary ? summary(report) : render(report));
  } catch (e) {
    console.log(`vault-lint: not run (${(e as Error).message})`);
  }
  process.exit(0);
}
