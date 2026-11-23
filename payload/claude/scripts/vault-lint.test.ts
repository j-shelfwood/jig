import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { lint, openTaskLines, summary, visibleLines } from "./vault-lint.ts";

const TODAY = "2026-03-30";

function put(v: string, rel: string, text: string) {
  mkdirSync(dirname(join(v, rel)), { recursive: true });
  writeFileSync(join(v, rel), text);
}

function vault() {
  const v = mkdtempSync(join(tmpdir(), "vl-"));
  const fresh = "---\ntype: handoff\nproject: '[[Acme]]'\nupdated: '2026-03-25'\n---\n## State\n- ok\n";
  put(v, "Projects/Acme/Acme.md", "---\ntype: project\n---\n");
  put(v, "Projects/Acme/handoff.md", fresh);
  put(v, "Projects/Acme/tracker.md", "- [ ] fine here\n");
  put(v, "Projects/Acme/tracker-archive.md", "- [x] old ✅ 2026-01-01\n");
  put(v, "Projects/Acme/decisions.md", "index\n");
  put(v, "Projects/Acme/audit-2026-03-01.md", "dated\n");
  put(v, "Projects/Acme/notes.md", "undated\n- [ ] stray task\n```\n- [ ] inside a fence\n```\n");
  const dec = (extra: string) => `---\ntype: decision\nproject: '[[Acme]]'\ndate: 2026-03-01\ntitle: T\nsummary: S\n${extra}---\n`;
  put(v, "Projects/Acme/decisions/2026-03-01-old.md", dec("status: standing\n"));
  put(v, "Projects/Acme/decisions/2026-03-05-new.md", dec("status: standing\nsupersedes: '[[2026-03-01-old]]'\n"));
  put(v, "Projects/Acme/decisions/2026-03-06-ghost.md", dec("status: standing\nsupersedes:\n  - '[[2026-01-01-missing]]'\n"));
  put(v, "Projects/Acme/decisions/2026-03-07-thin.md", "---\ntype: decision\nstatus: standing\n---\n");
  put(v, "Projects/Old/handoff.md", "---\ntype: handoff\nupdated: '2026-02-01'\n---\n" + Array.from({ length: 41 }, (_, i) => `- line ${i}`).join("\n") + "\n");
  put(v, "Projects/Old/tracker.md", "");
  put(v, "Timeline/30-03-2026.md", "## Tasks\n- [ ] daily task\n");
  put(v, "Templates/Tracker.md", "- [ ] template task\n");
  put(v, "Resources/TASKS.md", "nope\n");
  return v;
}

test("each check finds its seeded defect and nothing else", () => {
  const r = lint(vault(), TODAY);
  const got = r.findings.map((f) => `${f.check} ${f.file}`).sort();
  expect(got).toEqual(
    [
      "decision Projects/Acme/decisions/2026-03-01-old.md",
      "decision Projects/Acme/decisions/2026-03-06-ghost.md",
      "decision Projects/Acme/decisions/2026-03-07-thin.md",
      "forbidden-name Resources/TASKS.md",
      "long-handoff Projects/Old/handoff.md",
      "stale-handoff Projects/Old/handoff.md",
      "stray-task Projects/Acme/notes.md",
      "undated-artifact Projects/Acme/notes.md",
    ].sort(),
  );
  expect(r.findings.find((f) => f.file.endsWith("thin.md"))!.detail).toBe("missing project, date, title, summary");
  expect(r.uncommitted).toBeNull();
  expect(summary(r)).toBe("vault-lint: 1 stale-handoff, 1 long-handoff, 1 stray-task, 1 undated-artifact, 3 decision, 1 forbidden-name, not a git repo");
});

test("uncommitted counts git status lines", () => {
  const v = vault();
  Bun.spawnSync(["git", "init", "-q", v]);
  expect(lint(v, TODAY).uncommitted).toBe(16);
});

test("visible lines skip frontmatter and collapsed callouts, task lines skip fences", () => {
  expect(visibleLines("---\na: 1\n---\n# H\n\n- x\n> [!note]- More\n> hidden\n> hidden\nafter\n> plain quote\n")).toBe(4);
  expect(openTaskLines("- [ ] a\n~~~\n- [ ] b\n~~~\n  - [ ] c\n- [x] d\n")).toEqual([1, 5]);
});
