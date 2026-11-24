// demo.ts: the one fictional demo project used by every landing scene ("Acme Kiosk", a small web shop), its
// vault built from payload/vault/Templates, and the real kit scripts run against it.
//
// The demo vault is generated into a temp folder at build time, in three states:
//   before  the tracker as the session finds it; the handoff is three weeks old
//   shaped  the shop owner's request became an #agent-ready line with a `done when:`
//   after   that line is done, a decision note exists, the handoff is rewritten, a daily-note Log line links it
// agent-queue.ts, vault-lint.ts and trace.ts run on it with a fixed date, and their stdout is what the scenes
// print. A template that lost a section or placeholder the demo fills fails the build with the template's name.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ROOT, SourceError, readSource } from "./source.ts";

export const TODAY = "2026-03-12";
const STALE = "2026-02-19";
export const PROJECT = "Acme Kiosk";
export const REPO_SLUG = "acme-kiosk";
const T = "payload/vault/Templates";

/** The request that arrives in scene 1, and the task line it becomes, in parts so the scene can build it up. */
export const REQUEST = {
  from: "shop owner, by mail",
  text: "Customers keep asking where their receipt is. Can the shop mail one after checkout?",
  task: "Email a receipt after checkout",
  doneWhen: "`bun test checkout` passes and a test order puts one receipt in the mail outbox",
  priority: "🔼",
  due: "📅 2026-03-20",
};

export const taskLine = (state: "open" | "done") =>
  `- [${state === "done" ? "x" : " "}] ${REQUEST.task} #agent-ready done when: ${REQUEST.doneWhen} ${REQUEST.priority} ${REQUEST.due}` +
  (state === "done" ? ` ✅ ${TODAY}` : "");

/** The decision question of scene 4, as the tracker carries it until it is answered. */
const BLOCKED = "- [ ] Choose the sender address for receipt mail #blocked-on-me";
const OPEN = [
  "- [ ] Add a size filter to the catalogue #agent-ready done when: /catalogue?size=m lists only size M products ⏫",
  "- [ ] Fix the stock count after a refund #agent-ready",
  "- [ ] Confirm the VAT rate for gift cards #waiting-on/accountant 📅 2026-03-31",
  BLOCKED,
];
const DONE = ["- [x] Move product images to the CDN ✅ 2026-03-05"];

export const DECISION = {
  file: `decisions/${TODAY}-receipt-sender.md`,
  title: "Receipts are sent from the shop's own domain",
  summary: "Receipts go out through the mail provider from the shop domain, because the payment provider's template cannot carry the shop logo",
  quote: "Shop domain. Go.",
  source: "decision question in the session of 12 March",
};

const HANDOFF_BEFORE = {
  State: ["- Image CDN move in review", "- Checkout has no receipt mail yet"],
  Next: ["- CDN move · agent · 2026-02-21"],
  Communication: ["- shop owner: asked about the CDN costs · no open asks"],
  "Open questions": ["- none"],
};
const HANDOFF_AFTER = {
  State: ["- Receipt mail live on feat/email-receipt, sent from the shop domain ([[" + DECISION.file.replace(/^decisions\/|\.md$/g, "") + "]])", "- Size filter merged; product images on the CDN"],
  Next: ["- Stock count after a refund needs a `done when:` · you · 2026-03-13"],
  Communication: ["- shop owner: receipt request answered · no open asks"],
  "Open questions": ["- VAT rate for gift cards (waiting on the accountant)"],
};

// ---- template filling -------------------------------------------------------------------------------------

function fill(tpl: string, file: string, date: string, extra: Record<string, string> = {}): string {
  let out = tpl
    .replace(/\{\{project\}\}/g, PROJECT)
    .replace(/\{\{title\}\}/g, extra.title ?? PROJECT)
    .replace(/\{\{date:YYYY-MM-DD\}\}/g, date)
    .replace(/\{\{date:DD-MM-YYYY\}\}/g, date.split("-").reverse().join("-"));
  for (const [needle, value] of Object.entries(extra)) {
    if (needle === "title") continue;
    if (!out.includes(needle)) throw new SourceError(file, `template lost "${needle}", which the landing demo fills`);
    out = out.replace(needle, value);
  }
  const left = /\{\{[^}]+\}\}/.exec(out);
  if (left) throw new SourceError(file, `template has a placeholder the landing demo does not fill: ${left[0]}`);
  return out;
}

/** Inserts `lines` after the `## heading` line (before the next heading). */
export function under(text: string, heading: string, lines: string[], file: string): string {
  const all = text.split("\n");
  const i = all.findIndex((l) => l.trim() === `## ${heading}`);
  if (i === -1) throw new SourceError(file, `template has no "## ${heading}" section`);
  let j = i + 1;
  while (j < all.length && !all[j]!.startsWith("## ") && !all[j]!.startsWith("> [!")) j++;
  // Template body lines are examples ("- what · owner · date"), except the "As of <date>" stamp.
  const body = all.slice(i + 1, j).filter((l) => /^As of /.test(l));
  return [...all.slice(0, i + 1), ...body, ...lines, "", ...all.slice(j)].join("\n");
}

function handoff(sections: Record<string, string[]>, updated: string): string {
  const file = `${T}/Handoff.md`;
  let t = fill(readSource(file), file, updated);
  for (const [h, lines] of Object.entries(sections)) t = under(t, h, lines, file);
  return t;
}

export type DemoState = "before" | "shaped" | "after";

/** The demo vault for a state, as repo-relative path → content. */
export function demoVault(state: DemoState): Record<string, string> {
  const P = `Projects/${PROJECT}`;
  const files: Record<string, string> = {};
  const projectTpl = `${T}/Project.md`;
  files[`${P}/${PROJECT}.md`] = fill(readSource(projectTpl), projectTpl, "2026-01-08", {
    'client: ""': "client: acme",
    "repo: ~/Projects/": `repo: ~/Projects/${REPO_SLUG}`,
    "what this project is for, in one sentence.": "a small web shop that sells printed goods and gift cards.",
  });
  const trackerTpl = `${T}/Tracker.md`;
  let tracker = fill(readSource(trackerTpl), trackerTpl, TODAY);
  // Done is flipped in place (vault-schema §5: `[ ]` → `[x]` + ✅ date, nothing else on the line changes).
  const flip = (l: string) => `${l.replace("- [ ]", "- [x]")} ✅ ${TODAY}`;
  const open =
    state === "before" ? OPEN : state === "shaped" ? [taskLine("open"), ...OPEN] : [taskLine("done"), ...OPEN.map((l) => (l === BLOCKED ? flip(l) : l))];
  const done = DONE;
  tracker = under(tracker, "Open", open, trackerTpl);
  tracker = under(tracker, "Done", done, trackerTpl);
  files[`${P}/tracker.md`] = tracker.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  files[`${P}/handoff.md`] = state === "after" ? handoff(HANDOFF_AFTER, TODAY) : handoff(HANDOFF_BEFORE, STALE);
  if (state === "after") {
    const decTpl = `${T}/Decision.md`;
    files[`${P}/${DECISION.file}`] = fill(readSource(decTpl), decTpl, TODAY, {
      title: DECISION.title,
      'title: ""': `title: "${DECISION.title}"`,
      'summary: ""': `summary: "${DECISION.summary}"`,
      'decided_by: ""': "decided_by: you",
      "The decision, in one or two sentences, and why.": `${DECISION.summary}.`,
      "<name>": "you",
      "<verbatim quote>": DECISION.quote,
      "<link to the message, call note or PR>": DECISION.source,
    });
    const dayTpl = `${T}/Daily Note.md`;
    files[`Timeline/${TODAY.split("-").reverse().join("-")}.md`] = under(fill(readSource(dayTpl), dayTpl, TODAY), "Log", [
      `- [[${PROJECT}]]: ${DECISION.title.toLowerCase()} → [[${DECISION.file.replace(/^decisions\/|\.md$/g, "")}]]`,
    ], dayTpl);
  }
  return files;
}

// ---- running the kit's scripts on it ----------------------------------------------------------------------

const GIT = ["-c", "user.name=demo", "-c", "user.email=demo@example.com", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false"];

/** Writes a demo vault state into a fresh temp folder, committed in its own git repo. */
export function writeVault(state: DemoState): string {
  const dir = mkdtempSync(join(tmpdir(), `jig-demo-${state}-`));
  for (const [rel, text] of Object.entries(demoVault(state))) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  execFileSync("git", [...GIT, "init", "-q"], { cwd: dir });
  execFileSync("git", [...GIT, "add", "."], { cwd: dir });
  execFileSync("git", [...GIT, "commit", "-qm", "demo"], { cwd: dir });
  return dir;
}

/** Runs a payload script with bun and returns stdout; a non-zero exit fails the build naming the script. */
export function runScript(script: string, args: string[], env: Record<string, string>): string {
  const file = `payload/claude/scripts/${script}`;
  readSource(file);
  try {
    return execFileSync(process.execPath, [join(ROOT, file), ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env, SCRIPTS_CONFIG: "/nonexistent" },
      timeout: 30000,
    }).trimEnd();
  } catch (e: any) {
    throw new SourceError(file, `failed on the demo vault: ${String(e.stderr || e.message).trim().split("\n")[0]}`);
  }
}

/** Synthetic transcripts in the record shapes documented in trace.ts: a push rejection that recurs. */
export function writeTranscripts(now = Date.now()): string {
  const dir = mkdtempSync(join(tmpdir(), "jig-demo-transcripts-"));
  const ts = (daysAgo: number, min: number) => new Date(now - daysAgo * 86400000 + min * 60000).toISOString();
  const rec = (sid: string, d: number, m: number, content: unknown[], type: "assistant" | "user") =>
    JSON.stringify({ type, sessionId: sid, timestamp: ts(d, m), message: { content } });
  const sessions: [string, number, [string, string][]][] = [
    ["s1", 26, [["Bash", "error: failed to push some refs to 'origin'\nhint: Updates were rejected because the remote contains work"], ["Edit", "File has not been read yet. Read it first before writing to it."]]],
    ["s2", 19, [["Bash", "error: failed to push some refs to 'origin'\nhint: Updates were rejected because the tip of your branch is behind"], ["Read", "File does not exist."]]],
    ["s3", 12, [["Bash", "error: failed to push some refs to 'origin'"], ["Edit", "File has not been read yet. Read it first before writing to it."]]],
    ["s4", 6, [["Bash", "error: failed to push some refs to 'origin'"], ["Edit", "File has not been read yet. Read it first before writing to it."]]],
    ["s5", 2, [["Bash", "error: failed to push some refs to 'origin'"]]],
  ];
  for (const [sid, d, errors] of sessions) {
    const lines: string[] = [];
    errors.forEach(([tool, text], i) => {
      const id = `${sid}-${i}`;
      lines.push(rec(sid, d, i * 2, [{ type: "tool_use", id, name: tool, input: {} }], "assistant"));
      lines.push(rec(sid, d, i * 2 + 1, [{ type: "tool_result", tool_use_id: id, is_error: true, content: text }], "user"));
    });
    mkdirSync(join(dir, `-work-${REPO_SLUG}`), { recursive: true });
    writeFileSync(join(dir, `-work-${REPO_SLUG}`, `${sid}.jsonl`), lines.join("\n") + "\n");
  }
  return dir;
}

export type DemoRuns = {
  queue: { cmd: string; out: string };
  lintBefore: { cmd: string; out: string };
  lintAfter: { cmd: string; out: string };
  clusters: { cmd: string; out: string };
  vault: { before: Record<string, string>; shaped: Record<string, string>; after: Record<string, string> };
};

export function runDemo(): DemoRuns {
  const dirs: string[] = [];
  try {
    const shaped = writeVault("shaped");
    const before = writeVault("before");
    const after = writeVault("after");
    const tr = writeTranscripts();
    dirs.push(shaped, before, after, tr);
    const queueArgs = ["--repo", REPO_SLUG, "--today", TODAY];
    const lintArgs = ["--today", TODAY];
    const queue = runScript("agent-queue.ts", queueArgs, { VAULT_ROOT: shaped });
    if (!queue.includes(REQUEST.task)) throw new SourceError("payload/claude/scripts/agent-queue.ts", `did not list the demo's #agent-ready line:\n${queue}`);
    const lintBefore = runScript("vault-lint.ts", lintArgs, { VAULT_ROOT: before });
    const lintAfter = runScript("vault-lint.ts", ["--summary", ...lintArgs], { VAULT_ROOT: after });
    if (!/stale-handoff/.test(lintBefore.split("\n")[0]!)) throw new SourceError("payload/claude/scripts/vault-lint.ts", `no stale-handoff finding on the demo's old handoff:\n${lintBefore}`);
    const clusters = runScript("trace.ts", ["clusters", "--since", "30d", "--min", "3"], { TRANSCRIPTS_DIR: tr });
    if (!/push/.test(clusters)) throw new SourceError("payload/claude/scripts/trace.ts", `did not cluster the demo's push rejections:\n${clusters}`);
    return {
      queue: { cmd: `bun agent-queue.ts ${queueArgs.slice(0, 2).join(" ")}`, out: queue },
      lintBefore: { cmd: "bun vault-lint.ts", out: lintBefore },
      lintAfter: { cmd: "bun vault-lint.ts --summary", out: lintAfter },
      clusters: { cmd: "bun trace.ts clusters --since 30d", out: clusters },
      vault: { before: demoVault("before"), shaped: demoVault("shaped"), after: demoVault("after") },
    };
  } finally {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  }
}
