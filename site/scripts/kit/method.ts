// method.ts: the loop steps of docs/method.md, for the hero ring and the scene captions.
//
// Source shape: under `## The loop`, one `### <n> <Name>` heading per step, a paragraph, then three bullets
// `- **Leaves behind:** …`, `- **Prevents:** …`, `- **In the kit:** …`. Wikilinks in the text become links
// to the docs pages through the same resolver the docs build uses, so a link that would 404 fails here too.
import { join } from "node:path";
import { readPage, resolveWikilink } from "../../src/plugins/remark-wikilinks.ts";
import { ROOT, SourceError, escapeHtml, readSource } from "./source.ts";

export type Step = {
  n: number;
  name: string;
  /** Heading id on /docs/method/ (computed the way Astro computes it). */
  id: string;
  href: string;
  /** The step paragraph, as inline HTML. */
  body: string;
  leaves: string;
  prevents: string;
  kit: string;
};

const FILE = "docs/method.md";
const BULLETS = { leaves: "Leaves behind", prevents: "Prevents", kit: "In the kit" } as const;

/** Inline Markdown subset used in docs/method.md (code spans, bold, wikilinks) to HTML. */
export function inlineHtml(md: string, docsDir = join(ROOT, "docs"), page = "method"): string {
  const lookup = (p: string) => readPage(docsDir, p);
  const parts = md.split(/(`[^`]+`)/);
  return parts
    .map((part) => {
      if (/^`[^`]+`$/.test(part)) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      let out = "";
      let last = 0;
      for (const m of part.matchAll(/\[\[([^\]\n]+?)\]\]/g)) {
        out += escapeHtml(part.slice(last, m.index));
        const { href, text } = resolveWikilink(m[1]!.replace(/\\\|/g, "|"), page, lookup);
        const abs = href.startsWith("#") ? `/docs/${page}/${href}` : href;
        out += `<a href="${escapeHtml(abs)}">${escapeHtml(text)}</a>`;
        last = m.index! + m[0].length;
      }
      out += escapeHtml(part.slice(last));
      return out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    })
    .join("");
}

export function parseMethod(src: string, docsDir = join(ROOT, "docs"), file = FILE): Step[] {
  const body = src.replace(/^---\n[\s\S]*?\n---\n/, "");
  const loop = /^## The loop\s*$([\s\S]*?)(?=^## )/m.exec(body + "\n## end\n");
  if (!loop) throw new SourceError(file, 'no "## The loop" section');
  const anchors = readPage(docsDir, "method")?.anchors;
  if (!anchors) throw new SourceError(file, "docs page could not be read for heading ids");
  const chunks = loop[1]!.split(/^### /m).slice(1);
  if (chunks.length === 0) throw new SourceError(file, 'no "### <n> <Step>" headings under "## The loop"');
  return chunks.map((chunk, i) => {
    const [heading, ...rest] = chunk.split("\n");
    const hm = /^(\d+)\s+(.+?)\s*$/.exec(heading!);
    if (!hm) throw new SourceError(file, `step heading "### ${heading}" is not "### <n> <Name>"`);
    const n = Number(hm[1]);
    if (n !== i + 1) throw new SourceError(file, `step "### ${heading}" is number ${n}, expected ${i + 1}`);
    const name = hm[2]!;
    const text = rest.join("\n");
    const para = text.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith("- "));
    if (!para) throw new SourceError(file, `step "${name}" has no paragraph`);
    const bullet = (label: string) => {
      const m = new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, "m").exec(text);
      if (!m) throw new SourceError(file, `step "${name}" lacks the "- **${label}:**" bullet`);
      return inlineHtml(m[1]!.trim(), docsDir);
    };
    const id = anchors.get(heading!.trim());
    if (!id) throw new SourceError(file, `no heading id for "### ${heading}"`);
    return {
      n,
      name,
      id,
      href: `/docs/method/#${id}`,
      body: inlineHtml(para.replace(/\s*\n\s*/g, " "), docsDir),
      leaves: bullet(BULLETS.leaves),
      prevents: bullet(BULLETS.prevents),
      kit: bullet(BULLETS.kit),
    };
  });
}

export const loadMethod = () => parseMethod(readSource(FILE));

/** Step `n`, or a SourceError naming docs/method.md when the loop has fewer steps than a scene needs. */
export function step(steps: Step[], n: number): Step {
  const s = steps.find((x) => x.n === n);
  if (!s) throw new SourceError(FILE, `the landing page has a scene for step ${n}, but the loop has ${steps.length} steps`);
  return s;
}
