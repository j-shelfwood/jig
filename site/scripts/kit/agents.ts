// agents.ts: the typed worker roster, from payload/claude/agents/*.md frontmatter.
//
// Required keys: name, description, model. `tools` is an allowlist; without it the worker has every tool
// except `disallowedTools`. The roster order is the file order (alphabetical), so a new agent file shows up
// on the landing page without an edit here.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SourceError, firstSentence, frontmatter, readSource } from "./source.ts";

export type Worker = {
  name: string;
  model: string;
  /** First sentence of the description. */
  purpose: string;
  tools: string[];
  /** "allowlist" when `tools` is set, else "all except" the disallowed list. */
  toolMode: "allowlist" | "all except";
  file: string;
};

export const AGENTS_DIR = "payload/claude/agents";

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function parseAgent(text: string, file: string): Worker {
  const fm = frontmatter(text);
  if (!fm) throw new SourceError(file, "no frontmatter");
  for (const key of ["name", "description", "model"])
    if (!fm[key]) throw new SourceError(file, `frontmatter lacks "${key}"`);
  const allow = list(fm.tools);
  return {
    name: fm.name!,
    model: fm.model!,
    purpose: firstSentence(fm.description!),
    tools: allow.length ? allow : list(fm.disallowedTools),
    toolMode: allow.length ? "allowlist" : "all except",
    file,
  };
}

export function loadAgents(root = ROOT): Worker[] {
  const dir = join(root, AGENTS_DIR);
  const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  if (files.length === 0) throw new SourceError(AGENTS_DIR, "no agent files");
  return files.map((f) => parseAgent(readSource(`${AGENTS_DIR}/${f}`, root), `${AGENTS_DIR}/${f}`));
}

/** The worker called `name`, or a SourceError naming the agents folder (a scene names a worker that is gone). */
export function worker(roster: Worker[], name: string): Worker {
  const w = roster.find((x) => x.name === name);
  if (!w) throw new SourceError(AGENTS_DIR, `no agent "${name}" (a landing scene uses it); agents: ${roster.map((x) => x.name).join(", ")}`);
  return w;
}

/** Verdict words the verifier returns, from its description ("returns A, B or C"). */
export function verdicts(roster: Worker[], root = ROOT): string[] {
  const v = worker(roster, "verifier");
  const desc = frontmatter(readSource(v.file, root))!.description!;
  const m = /returns ([A-Z]+(?:, [A-Z]+)*(?:,? or [A-Z]+))/.exec(desc);
  if (!m) throw new SourceError(v.file, 'description no longer says "returns X, Y or Z" with the verdict words');
  return m[1]!.split(/,\s*|\s+or\s+/).filter(Boolean);
}
