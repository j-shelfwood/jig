#!/usr/bin/env bun
// check-links.ts: every internal link in the built site resolves, pages and #anchors both.
//
// Why: docs/ links across pages with Obsidian wikilinks and heading anchors; a renamed heading breaks an
// anchor silently (the page still loads). remark-wikilinks fails the build for the docs it resolves; this
// walks the final HTML, so it also covers the layouts, the landing page and links written by hand.
//
// Usage: bun site/scripts/check-links.ts [dist dir]     default site/dist; exit 1 on any broken link.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const dist = process.argv[2] ?? join(import.meta.dir, "../dist");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const pages = walk(dist).filter((f) => f.endsWith(".html"));

const idsCache = new Map<string, Set<string>>();
const ids = (file: string) => {
  if (!idsCache.has(file)) {
    const html = readFileSync(file, "utf8");
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeEntities(m[1]))));
  }
  return idsCache.get(file)!;
};
const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** URL path → the file nginx serves for it (deploy/nginx.conf try_files order). */
function target(path: string): string | undefined {
  const base = join(dist, decodeURIComponent(path));
  for (const c of [base, `${base}/index.html`, `${base}index.html`, `${base}.html`]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return undefined;
}

const broken: string[] = [];
let checked = 0;
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const pagePath = "/" + relative(dist, page).replace(/index\.html$/, "");
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const raw = decodeEntities(m[1]);
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(raw)) continue;
    checked++;
    const [pathPart, hash] = raw.split("#", 2);
    const abs = pathPart === "" ? pagePath : pathPart.startsWith("/") ? pathPart : join(dirname(pagePath + "x"), pathPart);
    const file = pathPart === "" ? page : target(abs);
    if (!file) { broken.push(`${relative(dist, page)}: ${raw} (no such page)`); continue; }
    if (hash && file.endsWith(".html") && !ids(file).has(decodeURIComponent(hash))) {
      broken.push(`${relative(dist, page)}: ${raw} (no id "${hash}" in ${relative(dist, file)})`);
    }
  }
}

for (const b of broken) console.log(b);
console.log(`check-links: ${pages.length} pages, ${checked} internal links, ${broken.length} broken`);
process.exit(broken.length ? 1 : 0);
