// remark-wikilinks: turn Obsidian wikilinks in docs/*.md into links to the built docs pages.
//
// docs/ stays a plain Obsidian folder, so the pages link to each other as [[page]], [[page|alias]],
// [[page#Heading]], [[page#Heading|alias]] and [[#Heading|alias]]. Each becomes /docs/<page>/#<id>, where
// <id> is computed the way Astro computes heading ids (rehypeHeadingIds in @astrojs/markdown-remark: one
// github-slugger per file over the text of every heading in document order, trailing "-" removed), so the
// anchor always exists. Headings are matched with curly quotes and dashes folded to their ASCII spelling,
// because Astro's smartypants rewrites the link text before this plugin runs. A link to a missing page or heading fails the build instead of shipping a dead link.
//
// `\|` inside a GFM table cell is already unescaped to `|` by the parser, so table wikilinks need no case.
import { readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import GithubSlugger from "github-slugger";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkSmartypants from "remark-smartypants";
import { toString } from "mdast-util-to-string";
import type { Root, Parent, PhrasingContent, Text, Heading } from "mdast";

export interface WikilinkOptions {
  /** Absolute path of the folder holding the Obsidian notes (docs/). */
  docsDir: string;
  /** URL prefix of the docs pages; "index" maps to the prefix itself. */
  base?: string;
}

interface PageInfo {
  title: string;
  /** Heading text → id, plus id → id, so a link may name either. */
  anchors: Map<string, string>;
}

const WIKILINK = /\[\[([^\]\n]+?)\]\]/g;

const stripFrontmatter = (src: string) => src.replace(/^---\n[\s\S]*?\n---\n/, "");

/** Link text and heading text are compared in this form: smartypants output folded back to ASCII. */
export const foldPunctuation = (s: string) =>
  s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2014/g, "---").replace(/\u2013/g, "--").replace(/\u2026/g, "...");

export function astroHeadingId(slugger: GithubSlugger, text: string): string {
  const slug = slugger.slug(text);
  return slug.endsWith("-") ? slug.slice(0, -1) : slug;
}

export function readPage(docsDir: string, page: string): PageInfo | undefined {
  const file = join(docsDir, `${page}.md`);
  if (!existsSync(file)) return undefined;
  const src = readFileSync(file, "utf8");
  const title = src.match(/^---\n[\s\S]*?^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? page;
  const anchors = new Map<string, string>();
  const slugger = new GithubSlugger();
  const walk = (node: Parent) => {
    for (const child of node.children) {
      if (child.type === "heading") {
        const text = toString(child as Heading);
        const id = astroHeadingId(slugger, text);
        if (!anchors.has(foldPunctuation(text))) anchors.set(foldPunctuation(text), id);
        anchors.set(`#${id}`, id);
      } else if ("children" in child) walk(child as Parent);
    }
  };
  // The same remark chain Astro runs before user plugins (gfm, then smartypants), so heading text, and with
  // it the slug, is what rehypeHeadingIds will see.
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkSmartypants);
  walk(processor.runSync(processor.parse(stripFrontmatter(src))) as Root);
  return { title, anchors };
}

export function resolveWikilink(
  inner: string,
  currentPage: string,
  lookup: (page: string) => PageInfo | undefined,
  base = "/docs/",
): { href: string; text: string } {
  const bar = inner.indexOf("|");
  const target = (bar === -1 ? inner : inner.slice(0, bar)).trim();
  const alias = bar === -1 ? undefined : inner.slice(bar + 1).trim();
  const hash = target.indexOf("#");
  const page = (hash === -1 ? target : target.slice(0, hash)).trim() || currentPage;
  const heading = hash === -1 ? undefined : target.slice(hash + 1).trim();

  const info = lookup(page);
  if (!info) throw new Error(`wikilink [[${inner}]] in ${currentPage}.md: no page docs/${page}.md`);
  let anchor = "";
  if (heading) {
    const id = info.anchors.get(foldPunctuation(heading)) ?? info.anchors.get(`#${heading}`);
    if (!id) throw new Error(`wikilink [[${inner}]] in ${currentPage}.md: no heading "${heading}" in docs/${page}.md`);
    anchor = `#${id}`;
  }
  const pageHref = page === "index" ? base : `${base}${page}/`;
  const href = page === currentPage && anchor ? anchor : `${pageHref}${anchor}`;
  return { href, text: alias ?? heading ?? info.title };
}

export default function remarkWikilinks(options: WikilinkOptions) {
  const base = options.base ?? "/docs/";
  const cache = new Map<string, PageInfo | undefined>();
  const lookup = (page: string) => {
    if (!cache.has(page)) cache.set(page, readPage(options.docsDir, page));
    return cache.get(page);
  };

  return (tree: Root, file: { path?: string }) => {
    const currentPage = file.path ? basename(file.path, ".md") : "index";
    const visit = (node: Parent) => {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === "text" && child.value.includes("[[")) {
          const parts: PhrasingContent[] = [];
          let last = 0;
          for (const m of child.value.matchAll(WIKILINK)) {
            if (m.index! > last) parts.push({ type: "text", value: child.value.slice(last, m.index) });
            const { href, text } = resolveWikilink(m[1], currentPage, lookup, base);
            parts.push({ type: "link", url: href, children: [{ type: "text", value: text } as Text] });
            last = m.index! + m[0].length;
          }
          if (parts.length === 0) continue;
          if (last < child.value.length) parts.push({ type: "text", value: child.value.slice(last) });
          node.children.splice(i, 1, ...(parts as typeof node.children));
          i += parts.length - 1;
        } else if ("children" in child && child.type !== "link") {
          visit(child as Parent);
        }
      }
    };
    visit(tree);
  };
}
