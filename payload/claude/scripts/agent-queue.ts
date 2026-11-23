#!/usr/bin/env bun
// agent-queue.ts: list the vault tasks an agent may pick up without asking. Read-only.
//
// Why: "work the next ready task" needs one deterministic answer. A ready task is an open line (`- [ ]`)
// tagged #agent-ready whose text carries `done when:` (the observable that ends the work), that is not
// blocked (#blocked-on-me, #waiting-on/<slug>) and not hidden by a 🛫 start or ⏳ scheduled date after today.
// Open tasks live only in Projects/<P>/tracker.md and Timeline/*.md (vault-schema §3).
// Order: priority 🔺 ⏫ 🔼 (none) 🔽 ⏬, then 📅 due (undated last), then file and line.
//
// Usage:
//   bun agent-queue.ts [--json] [--repo <name>] [--today YYYY-MM-DD]
//     --repo <name>  only tasks of project <name>: its tracker.md, plus daily-note tasks linking [[<name>]].
//                    <name> matches the project folder, or the basename of a `repo:` line in its entry note.
// Vault root: env VAULT_ROOT, else ~/.claude/scripts/config.json (see config.ts).
// Output: `<file>:<line> <text>` per task, then one `#` summary line with the count lacking `done when:`.
import { parseArgs } from "node:util";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { localToday, vaultRoot } from "./config.ts";

export type Ready = { file: string; line: number; text: string; doneWhen: string; priority: number; due: string; project: string | null };

const PRIORITY: Record<string, number> = { "🔺": 0, "⏫": 1, "🔼": 2, "🔽": 4, "⏬": 5 };
const NO_PRIORITY = 3;
const NO_DUE = "9999-12-31";
const dateAfter = (line: string, mark: string) => line.match(new RegExp(`${mark}\\s*(\\d{4}-\\d{2}-\\d{2})`, "u"))?.[1];

/** A ready task, "no-done-when" for an otherwise ready line without the observable, or null. */
export function parseTask(raw: string, today: string): Omit<Ready, "file" | "line" | "project"> | "no-done-when" | null {
  if (!/^\s*[-*] \[ \] /.test(raw) || !/(^|\s)#agent-ready(?![\w/-])/.test(raw)) return null;
  if (/(^|\s)#blocked-on-me(?![\w-])|(^|\s)#waiting-on\//.test(raw)) return null;
  for (const mark of ["🛫", "⏳"]) {
    const d = dateAfter(raw, mark);
    if (d && d > today) return null;
  }
  const done = raw.match(/done when:\s*(.*?)(?=\s+[🔺⏫🔼🔽⏬🔁🛫⏳📅✅🆔]|$)/u)?.[1]?.trim();
  if (!done) return "no-done-when";
  const mark = Object.keys(PRIORITY).find((m) => raw.includes(m));
  return {
    text: raw.replace(/^\s*[-*] \[ \] /, "").trim(),
    doneWhen: done,
    priority: mark ? PRIORITY[mark]! : NO_PRIORITY,
    due: dateAfter(raw, "📅") ?? NO_DUE,
  };
}

/** Project folder names whose folder or entry-note `repo:` basename equals `name` (case-insensitive). */
export function projectsMatching(vault: string, name: string): string[] {
  const root = join(vault, "Projects");
  if (!existsSync(root)) return [];
  const want = name.toLowerCase();
  return readdirSync(root).filter((p) => {
    if (!statSync(join(root, p)).isDirectory()) return false;
    if (p.toLowerCase() === want) return true;
    const entry = join(root, p, `${p}.md`);
    if (!existsSync(entry)) return false;
    const repos = [...readFileSync(entry, "utf8").matchAll(/^\s*-?\s*repo:\s*['"]?([^'"\n]+?)['"]?\s*$/gm)].map((m) => basename(m[1]!.trim()));
    return repos.some((r) => r.toLowerCase() === want);
  });
}

/** [file, project] pairs: project trackers carry their folder name, daily notes carry null. */
export function taskFiles(vault: string): [string, string | null][] {
  const out: [string, string | null][] = [];
  const projects = join(vault, "Projects");
  if (existsSync(projects))
    for (const p of readdirSync(projects).sort()) {
      const f = join(projects, p, "tracker.md");
      if (existsSync(f)) out.push([f, p]);
    }
  const timeline = join(vault, "Timeline");
  if (existsSync(timeline)) for (const f of readdirSync(timeline).sort()) if (f.endsWith(".md")) out.push([join(timeline, f), null]);
  return out;
}

export function readyTasks(vault: string, today: string, repo?: string) {
  const only = repo === undefined ? null : new Set(projectsMatching(vault, repo));
  const ready: Ready[] = [];
  let withoutDoneWhen = 0;
  for (const [abs, project] of taskFiles(vault)) {
    const file = abs.slice(vault.length + 1);
    readFileSync(abs, "utf8")
      .split("\n")
      .forEach((raw, i) => {
        if (only) {
          const linked = [...only].some((p) => raw.includes(`[[${p}]]`) || raw.includes(`[[${p}|`));
          if (project ? !only.has(project) : !linked) return;
        }
        const t = parseTask(raw, today);
        if (t === "no-done-when") withoutDoneWhen++;
        else if (t) ready.push({ file, line: i + 1, project, ...t });
      });
  }
  ready.sort((a, b) => a.priority - b.priority || a.due.localeCompare(b.due) || a.file.localeCompare(b.file) || a.line - b.line);
  return { ready, withoutDoneWhen };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      json: { type: "boolean", default: false },
      repo: { type: "string" },
      today: { type: "string", default: localToday() },
    },
  });
  const { ready, withoutDoneWhen } = readyTasks(vaultRoot(), values.today!, values.repo);
  if (values.json) console.log(JSON.stringify({ ready, withoutDoneWhen }, null, 1));
  else {
    for (const t of ready) console.log(`${t.file}:${t.line} ${t.text}`);
    console.log(`# ${ready.length} ready; ${withoutDoneWhen} tagged #agent-ready without "done when:" (not listed)`);
  }
}
