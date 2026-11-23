// config.ts: shared path resolution for the scripts in this folder.
// Why: every tool needs the vault root (and agent-queue the code folder) without hard-coding a person's paths.
// Order: env VAULT_ROOT / PROJECTS_ROOT, then config.json next to this file (installed: ~/.claude/scripts/config.json,
// copied from config.example.json), else an error that names both. A leading ~ is expanded.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type Config = { vault?: string; projects?: string };

const expand = (p: string) => (p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

export function readConfig(file = process.env.SCRIPTS_CONFIG ?? join(import.meta.dir, "config.json")): Config {
  if (!existsSync(file)) return {};
  try {
    const c = JSON.parse(readFileSync(file, "utf8"));
    return typeof c === "object" && c ? c : {};
  } catch {
    return {};
  }
}

export function vaultRoot(): string {
  const v = process.env.VAULT_ROOT || readConfig().vault;
  if (!v || v.includes("<<")) throw new Error("vault root unknown: set VAULT_ROOT or fill \"vault\" in ~/.claude/scripts/config.json");
  return expand(v).replace(/\/+$/, "");
}

export function projectsRoot(): string | null {
  const p = process.env.PROJECTS_ROOT || readConfig().projects;
  return p && !p.includes("<<") ? expand(p).replace(/\/+$/, "") : null;
}

/** Today as YYYY-MM-DD in local time. */
export const localToday = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
