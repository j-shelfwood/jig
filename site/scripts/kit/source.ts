// source.ts: shared helpers for the landing-page generator (site/scripts/gen.ts).
//
// Every scene on the landing page is derived from a file in this repository. When a source no longer has
// the shape a parser expects (a renamed heading, a missing frontmatter key, a hook that stopped printing a
// reason), the parser throws a SourceError naming the file, and gen.ts fails the build with it. An empty
// scene is never rendered silently.
import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/** Repository root (site/scripts/kit → ../../..). */
export const ROOT = join(import.meta.dir, "..", "..", "..");

export class SourceError extends Error {
  constructor(public file: string, detail: string) {
    super(`${file}: ${detail}`);
    this.name = "SourceError";
  }
}

/** Repo-relative display path for an absolute or relative path. */
export const rel = (p: string) => (p.startsWith("/") ? relative(ROOT, p) : p);

export function readSource(relPath: string, root = ROOT): string {
  const abs = join(root, relPath);
  if (!existsSync(abs)) throw new SourceError(relPath, "file is missing");
  return readFileSync(abs, "utf8");
}

/** Throws a SourceError on `file` when `value` is empty or undefined. */
export function need<T>(file: string, value: T | undefined | null | "", what: string): T {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))
    throw new SourceError(file, `${what} not found`);
  return value as T;
}

/** Simple YAML frontmatter (key: value lines; quotes stripped). Null when the file has none. */
export function frontmatter(text: string): Record<string, string> | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]!] = kv[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return fm;
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** First sentence of a paragraph (up to ". " followed by a capital, or the end). */
export function firstSentence(s: string): string {
  const m = /^(.+?[.!?])(?=\s+[A-Z(`"])/.exec(s.trim());
  return (m ? m[1]! : s).trim();
}
