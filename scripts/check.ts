#!/usr/bin/env bun
// check.ts: consistency checks for this repository (not for an installed setup).
//
// Why: the payload is a set of files that point at each other (settings.json → hooks, CLAUDE.md → vault
// prompt files, BOOTSTRAP → payload paths, placeholders → the interview). A rename in one place silently
// breaks the install on someone else's machine, so CI checks the references instead of a reviewer.
//
// Usage: bun scripts/check.ts        exit 1 when any check fails; prints one line per failure.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const failures: string[] = [];
const fail = (check: string, msg: string) => failures.push(`${check}: ${msg}`);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
const files = walk(ROOT).map((p) => relative(ROOT, p));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// 1. Every UPPER_CASE placeholder used in payload/ is named in BOOTSTRAP.md (so the setup agent knows where its value comes from).
const bootstrap = read("BOOTSTRAP.md");
const placeholders = new Set<string>();
for (const f of files.filter((f) => f.startsWith("payload/"))) {
  for (const m of read(f).matchAll(/<<[A-Z_]+>>/g)) placeholders.add(m[0]);
}
for (const p of placeholders) if (!bootstrap.includes(p)) fail("placeholder", `${p} is used in payload/ but not named in BOOTSTRAP.md`);

// 2. JSON files parse.
for (const f of files.filter((f) => f.endsWith(".json"))) {
  try { JSON.parse(read(f)); } catch (e) { fail("json", `${f}: ${(e as Error).message}`); }
}

// 3. Every hook command in payload settings.json exists in payload/claude/hooks and is executable.
const settings = JSON.parse(read("payload/claude/settings.json"));
for (const groups of Object.values<any[]>(settings.hooks ?? {})) {
  for (const g of groups) for (const h of g.hooks ?? []) {
    const m = String(h.command).match(/~\/\.claude\/(hooks\/[^\s"']+)/);
    if (!m) { fail("hook", `unrecognised command ${h.command}`); continue; }
    const rel = `payload/claude/${m[1]}`;
    if (!existsSync(join(ROOT, rel))) fail("hook", `${rel} is wired in settings.json but missing`);
    else if (!(statSync(join(ROOT, rel)).mode & 0o111)) fail("hook", `${rel} is not executable`);
  }
}
for (const f of files.filter((f) => /^payload\/claude\/hooks\/[^/]+\.sh$/.test(f))) {
  if (!JSON.stringify(settings).includes(f.replace("payload/claude/", "~/.claude/"))) fail("hook", `${f} exists but is not wired in settings.json`);
}

// 4. Agents and skills carry name and description frontmatter.
for (const f of files.filter((f) => /^payload\/claude\/(agents\/[^/]+|skills\/[^/]+\/SKILL)\.md$/.test(f))) {
  const fm = read(f).match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { fail("frontmatter", `${f} has none`); continue; }
  for (const key of ["name", "description"]) if (!new RegExp(`^${key}: \\S`, "m").test(fm[1])) fail("frontmatter", `${f} lacks ${key}`);
  const desc = fm[1].match(/^description: (.*)$/m)?.[1] ?? "";
  if (/: /.test(desc) && !/^["']/.test(desc)) fail("frontmatter", `${f}: unquoted ": " in description breaks strict YAML parsers`);
}

// 5. Every @import in the payload CLAUDE.md resolves to a payload vault file.
for (const m of read("payload/claude/CLAUDE.md").matchAll(/^@<<VAULT>>\/<<AGENT_DIR>>\/(\S+)$/gm)) {
  if (!existsSync(join(ROOT, "payload/vault/Agent", m[1]))) fail("import", `@…/${m[1]} has no payload/vault/Agent/${m[1]}`);
}
if (/^@(?!<<VAULT>>\/<<AGENT_DIR>>\/)/m.test(read("payload/claude/CLAUDE.md"))) fail("import", "an @import outside <<VAULT>>/<<AGENT_DIR>>/");

// 6. Backticked payload/… and docs/… paths in the docs exist (a trailing / means a folder; {a,b} and * are expanded loosely).
for (const f of ["README.md", "BOOTSTRAP.md", ...files.filter((f) => f.startsWith("docs/"))].filter((f) => existsSync(join(ROOT, f)))) {
  for (const m of read(f).matchAll(/`((?:payload|docs|scripts)\/[^`\s]*)`/g)) {
    const raw = m[1].replace(/\{([^}]*)\}/, (_, alts) => alts.split(",")[0]);
    const base = raw.split("*")[0].replace(/\/$/, "");
    if (!existsSync(join(ROOT, base))) fail("path", `${f} mentions \`${m[1]}\`, which does not exist`);
  }
}

// 7. Public-repo hygiene: no real-looking mail addresses, no absolute home paths, no em dashes in prose.
for (const f of files.filter((f) => /\.(md|ts|sh|json|base)$/.test(f) && f !== "scripts/check.ts")) {
  const t = read(f);
  for (const m of t.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[a-z]{2,}/g)) {
    if (!/@example\.(com|org)$/.test(m[0]) && !m[0].startsWith("noreply@")) fail("privacy", `${f}: address ${m[0]}`);
  }
  if (/\/Users\/[a-z]|\/home\/[a-z]/.test(t)) fail("privacy", `${f}: absolute home path`);
  if (f.endsWith(".md") && t.includes("—")) fail("style", `${f}: em dash`);
}

if (failures.length) {
  for (const l of failures) console.log(l);
  console.log(`check: ${failures.length} failing`);
  process.exit(1);
}
console.log(`check: ok (${files.length} files, ${placeholders.size} placeholders)`);
