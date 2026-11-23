import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTask, readyTasks } from "./agent-queue.ts";

const TODAY = "2026-03-10";

function vault() {
  const v = mkdtempSync(join(tmpdir(), "aq-"));
  mkdirSync(join(v, "Projects", "Acme"), { recursive: true });
  mkdirSync(join(v, "Projects", "Beta"), { recursive: true });
  mkdirSync(join(v, "Timeline"), { recursive: true });
  writeFileSync(join(v, "Projects", "Acme", "Acme.md"), "---\ntype: project\nsignals:\n  repo: ~/Code/acme-web\n---\n");
  writeFileSync(
    join(v, "Projects", "Acme", "tracker.md"),
    [
      "- [ ] Low one #agent-ready done when: test passes 🔽",
      "- [ ] High late #agent-ready done when: page loads ⏫ 📅 2026-04-01",
      "- [ ] High early #agent-ready done when: page loads ⏫ 📅 2026-03-12",
      "- [ ] No observable #agent-ready",
      "- [ ] Blocked #agent-ready #blocked-on-me done when: x",
      "- [ ] Waiting #agent-ready #waiting-on/sam done when: x",
      "- [ ] Future start #agent-ready done when: x 🛫 2026-03-20",
      "- [ ] Future scheduled #agent-ready done when: x ⏳ 2026-03-11",
      "- [x] Finished #agent-ready done when: x ✅ 2026-03-01",
      "- [ ] Untagged done when: x",
    ].join("\n"),
  );
  writeFileSync(join(v, "Projects", "Beta", "tracker.md"), "- [ ] Highest #agent-ready done when: ok 🔺\n");
  writeFileSync(join(v, "Timeline", "10-03-2026.md"), "## Tasks\n- [ ] Daily for [[Acme]] #agent-ready done when: done 🛫 2026-03-10\n");
  return v;
}

test("filters blocked, future and closed lines, counts missing done when", () => {
  const { ready, withoutDoneWhen } = readyTasks(vault(), TODAY);
  expect(ready.map((r) => r.text.split(" #")[0])).toEqual(["Highest", "High early", "High late", "Daily for [[Acme]]", "Low one"]);
  expect(withoutDoneWhen).toBe(1);
  expect(ready[1]!.file).toBe("Projects/Acme/tracker.md");
  expect(ready[1]!.line).toBe(3);
});

test("--repo matches the folder name or the entry note's repo basename", () => {
  const v = vault();
  const byRepo = readyTasks(v, TODAY, "acme-web").ready.map((r) => r.file);
  expect(byRepo).toEqual(["Projects/Acme/tracker.md", "Projects/Acme/tracker.md", "Timeline/10-03-2026.md", "Projects/Acme/tracker.md"]);
  expect(readyTasks(v, TODAY, "beta").ready.length).toBe(1);
  expect(readyTasks(v, TODAY, "nothing").ready.length).toBe(0);
});

test("parseTask extracts done when up to the first emoji field", () => {
  const t = parseTask("- [ ] X #agent-ready done when: GET /a returns 200 🔼 📅 2026-03-15", TODAY);
  expect(t).toMatchObject({ doneWhen: "GET /a returns 200", priority: 2, due: "2026-03-15" });
  expect(parseTask("- [ ] X #agent-readyish done when: y", TODAY)).toBeNull();
});
