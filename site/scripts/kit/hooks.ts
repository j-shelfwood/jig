// hooks.ts: the guardrail hooks, from payload/claude/settings.json wiring plus each script's header comment,
// and the real output of a hook run against a fixture payload.
//
// Header shape (every hook in payload/claude/hooks/): line 1 the shebang, then `# <file>.sh: <what it does>`
// (continued on following `#` lines up to a bare `#`), then a paragraph starting `# Why`.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, SourceError, firstSentence, readSource } from "./source.ts";

export type Hook = {
  name: string;
  file: string;
  event: string;
  matcher: string | null;
  /** What the header says the hook does. */
  what: string;
  /** First sentence of the header's Why paragraph. */
  why: string;
  /** The decisions the script can emit. */
  decisions: string[];
};

export const SETTINGS = "payload/claude/settings.json";

/** Comment text of the header, as an array of lines without the leading "# ". */
function headerLines(script: string): string[] {
  const out: string[] = [];
  for (const line of script.split("\n").slice(1)) {
    if (!line.startsWith("#")) break;
    out.push(line.replace(/^# ?/, ""));
  }
  return out;
}

export function parseHeader(script: string, file: string): { what: string; why: string } {
  const lines = headerLines(script);
  const base = file.split("/").pop()!;
  if (!lines[0]?.startsWith(`${base}: `)) throw new SourceError(file, `header does not start with "# ${base}: <what it does>"`);
  const what: string[] = [];
  for (const l of lines) {
    if (!l.trim()) break;
    what.push(l);
  }
  const start = lines.findIndex((l) => /^Why\b/.test(l));
  if (start === -1) throw new SourceError(file, 'header has no "# Why" paragraph');
  const why: string[] = [];
  for (const l of lines.slice(start)) {
    if (!l.trim() || (why.length && /^[A-Z][\w ]*:\s/.test(l) && !/^Why/.test(l))) break;
    why.push(l);
  }
  const whyText = why.join(" ").replace(/^Why[^:]*?:\s*/, (m) => (m.startsWith("Why (") ? m.replace(/^Why /, "") : ""));
  return {
    what: what.join(" ").slice(base.length + 2).trim(),
    why: firstSentence(whyText.replace(/^\(([^)]*)\):\s*/, "$1: ")),
  };
}

function decisionsOf(script: string): string[] {
  const d: string[] = [];
  if (/permissionDecision[^\n]*"deny"|"permissionDecision":"deny"|permissionDecision:"deny"/.test(script)) d.push("deny");
  if (/permissionDecision:"ask"|"permissionDecision":"ask"/.test(script)) d.push("ask");
  if (/decision:"block"|"decision":"block"/.test(script)) d.push("block");
  if (/additionalContext/.test(script)) d.push("context");
  return d;
}

export function loadHooks(root = ROOT): Hook[] {
  let settings: { hooks?: Record<string, any[]> };
  try {
    settings = JSON.parse(readSource(SETTINGS, root));
  } catch (e) {
    if (e instanceof SourceError) throw e;
    throw new SourceError(SETTINGS, `is not valid JSON: ${(e as Error).message}`);
  }
  const hooks: Hook[] = [];
  for (const [event, groups] of Object.entries<any[]>(settings.hooks ?? {}))
    for (const g of groups)
      for (const h of g.hooks ?? []) {
        const m = /~\/\.claude\/(hooks\/[^\s"']+\.sh)/.exec(String(h.command));
        if (!m) throw new SourceError(SETTINGS, `hook command "${h.command}" does not name ~/.claude/hooks/<name>.sh`);
        const file = `payload/claude/${m[1]}`;
        const script = readSource(file, root);
        hooks.push({
          name: m[1]!.replace(/^hooks\//, "").replace(/\.sh$/, ""),
          file,
          event,
          matcher: g.matcher ?? null,
          ...parseHeader(script, file),
          decisions: decisionsOf(script),
        });
      }
  if (hooks.length === 0) throw new SourceError(SETTINGS, "no hooks wired");
  return hooks;
}

export type HookRun = { hook: string; input: object; decision: string; reason: string };

/** Runs a hook script on a fixture payload and returns its decision and reason, as Claude Code would see them. */
export function runHook(hook: Hook, input: object, root = ROOT): HookRun {
  let out: string;
  try {
    out = execFileSync("bash", [join(root, hook.file)], { input: JSON.stringify(input), encoding: "utf8", timeout: 10000 });
  } catch (e) {
    throw new SourceError(hook.file, `failed on its fixture: ${(e as Error).message.split("\n")[0]} (needs bash and jq)`);
  }
  if (!out.trim()) throw new SourceError(hook.file, `printed nothing for the fixture ${JSON.stringify(input)}; the landing scene needs a decision`);
  let j: any;
  try {
    j = JSON.parse(out);
  } catch {
    throw new SourceError(hook.file, `printed invalid JSON for its fixture: ${out.slice(0, 120)}`);
  }
  const hso = j.hookSpecificOutput ?? {};
  const decision = hso.permissionDecision ?? j.decision ?? (hso.additionalContext ? "context" : "");
  const reason = hso.permissionDecisionReason ?? j.reason ?? hso.additionalContext ?? "";
  if (!decision || !reason) throw new SourceError(hook.file, `output has no decision or reason: ${out.slice(0, 120)}`);
  return { hook: hook.name, input, decision, reason };
}

/** Runs a hook's fixture test suite and returns its summary line ("<hook>: N passed, 0 failed"). */
export function runHookTests(hook: Hook, root = ROOT): string {
  const test = hook.file.replace(/hooks\/([^/]+)\.sh$/, "hooks/tests/$1.test.sh");
  readSource(test, root);
  let out: string;
  try {
    out = execFileSync("bash", [join(root, test)], { encoding: "utf8", timeout: 30000 });
  } catch (e: any) {
    throw new SourceError(test, `suite failed: ${String(e.stdout ?? e.message).trim().split("\n").pop()}`);
  }
  const last = out.trim().split("\n").pop()!;
  if (!/: \d+ passed, 0 failed$/.test(last)) throw new SourceError(test, `unexpected summary "${last}"`);
  return last;
}

export function hookByName(hooks: Hook[], name: string): Hook {
  const h = hooks.find((x) => x.name === name);
  if (!h) throw new SourceError(SETTINGS, `no wired hook "${name}" (a landing scene uses it); wired: ${hooks.map((x) => x.name).join(", ")}`);
  return h;
}
