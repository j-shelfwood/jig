// readme.ts: the quick start and the principles, from README.md (`## Quick start`, `## The ideas in one screen`).
import { ROOT, SourceError, escapeHtml, readSource } from "./source.ts";

export const README = "README.md";

export type Readme = { commands: string[]; prompt: string; after: string; warning: string; ideas: { lead: string; rest: string }[] };

const inline = (s: string) =>
  s
    .split(/(`[^`]+`)/)
    .map((p) => (/^`[^`]+`$/.test(p) ? `<code>${escapeHtml(p.slice(1, -1))}</code>` : escapeHtml(p).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")))
    .join("");

function section(src: string, title: string): string {
  const m = new RegExp(`^## ${title}\\s*$([\\s\\S]*?)(?=^## )`, "m").exec(src + "\n## end\n");
  if (!m) throw new SourceError(README, `no "## ${title}" section`);
  return m[1]!;
}

export function parseReadme(src: string): Readme {
  const qs = section(src, "Quick start");
  const commands = /```sh\n([\s\S]*?)\n```/.exec(qs)?.[1]?.split("\n").filter(Boolean);
  if (!commands?.length) throw new SourceError(README, '"## Quick start" has no ```sh block');
  const prompt = /^> (.+)$/m.exec(qs)?.[1];
  if (!prompt) throw new SourceError(README, '"## Quick start" has no "> prompt" line');
  const paras = qs.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !p.startsWith("```") && !p.startsWith(">") && !p.endsWith("```") && p !== "Then type:");
  if (paras.length < 2) throw new SourceError(README, '"## Quick start" lacks the paragraphs after the prompt');
  const ideas = section(src, "The ideas in one screen")
    .split("\n")
    .filter((l) => l.startsWith("- **"))
    .map((l) => {
      const m = /^- \*\*(.+?)\*\*\s*(.*)$/.exec(l)!;
      return { lead: inline(m[1]!), rest: inline(m[2]!) };
    });
  if (!ideas.length) throw new SourceError(README, '"## The ideas in one screen" has no "- **lead** rest" bullets');
  return { commands, prompt: escapeHtml(prompt), after: inline(paras[paras.length - 2]!), warning: inline(paras[paras.length - 1]!), ideas };
}

export const loadReadme = (root = ROOT) => parseReadme(readSource(README, root));
