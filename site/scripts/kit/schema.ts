// schema.ts: the task grammar and the semantic tags, from payload/vault/Constitution/vault-schema.md §3,
// and the folder → type table from §1.
import { ROOT, SourceError, readSource } from "./source.ts";

export const SCHEMA = "payload/vault/Constitution/vault-schema.md";

export type Schema = {
  /** The grammar lines inside the first code block of §3. */
  grammar: string[];
  tags: { tag: string; meaning: string }[];
  folders: { folder: string; type: string; purpose: string }[];
};

function section(src: string, title: RegExp, file: string): string {
  const parts = src.split(/^## /m);
  const s = parts.find((p) => title.test(p.split("\n")[0]!));
  if (!s) throw new SourceError(file, `no "## ${title.source}" section`);
  return s;
}

/** Rows of the first Markdown table in `text`, header row excluded. */
function tableRows(text: string): string[][] {
  const rows = text.split("\n").filter((l) => /^\|.*\|\s*$/.test(l.trim()));
  return rows
    .slice(2)
    .map((r) => r.trim().slice(1, -1).split("|").map((c) => c.trim()));
}

export function parseSchema(src: string, file = SCHEMA): Schema {
  const s3 = section(src, /^3\. Task grammar/, file);
  const grammar = /```\n([\s\S]*?)\n```/.exec(s3)?.[1]?.split("\n").filter(Boolean);
  if (!grammar?.length) throw new SourceError(file, "§3 has no grammar code block");
  const tagTable = s3.slice(s3.indexOf("| tag |"));
  if (!s3.includes("| tag |")) throw new SourceError(file, '§3 has no "| tag | meaning |" table');
  const tags = tableRows(tagTable).map(([tag, meaning]) => ({ tag: tag!, meaning: meaning! }));
  if (!tags.some((t) => t.tag === "`#agent-ready`")) throw new SourceError(file, "§3 tag table has no #agent-ready row");
  const s1 = section(src, /^1\. Folder/, file);
  const folders = tableRows(s1).map(([folder, type, purpose]) => ({ folder: folder!, type: type!, purpose: purpose! }));
  if (!folders.length) throw new SourceError(file, "§1 has no folder table");
  return { grammar, tags, folders };
}

export const loadSchema = (root = ROOT) => parseSchema(readSource(SCHEMA, root));
