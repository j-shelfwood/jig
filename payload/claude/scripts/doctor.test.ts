import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, parseCap, readCaps, render, runHealth } from "./doctor.ts";

function caps() {
  const d = mkdtempSync(join(tmpdir(), "doc-"));
  const cap = (service: string, health: string, status = "green") =>
    `---\nservice: ${service}\nhealth: ${health}\nverified: 2026-03-01\nstatus: ${status}         # comment\n---\n## Use\n`;
  writeFileSync(join(d, "good.md"), cap("good", "echo fine"));
  writeFileSync(join(d, "bad.md"), cap("bad", "echo boom >&2; exit 3"));
  writeFileSync(join(d, "later.md"), cap("later", "true", "planned"));
  writeFileSync(join(d, "_TEMPLATE.md"), cap("<<service-slug>>", "<<one shell line>>"));
  writeFileSync(join(d, "README.md"), "# readme\n");
  return d;
}

test("reads capabilities, skipping the template and README", () => {
  expect(readCaps(caps()).map((c) => c.service)).toEqual(["bad", "good", "later"]);
  expect(parseCap("x.md", "---\nservice: s\nhealth: gh auth status # keep\nstatus: green # drop\n---\n")).toMatchObject({ health: "gh auth status # keep", status: "green" });
});

test("runs health lines: exit 0 green, non-zero red, planned not run", async () => {
  const rows = await check(caps(), true);
  expect(rows.map((r) => [r.service, r.state, r.detail])).toEqual([
    ["bad", "red", "exit 3: boom"],
    ["good", "green", "fine"],
    ["later", "planned", ""],
  ]);
  expect(render(rows, true)).toBe("bad: exit 3: boom");
  expect(render(rows.filter((r) => r.state !== "red"), true)).toBe("");
  expect(render(rows, false).split("\n").at(-1)).toBe("1 green, 1 red, 1 planned");
});

test("a hanging health line times out red", async () => {
  const t0 = Date.now();
  const r = await runHealth({ file: "x", service: "slow", health: "sleep 5", status: "green", verified: "" }, 300);
  expect(r.state).toBe("red");
  expect(r.detail).toBe("timeout after 0.3s");
  expect(Date.now() - t0).toBeLessThan(2000);
});

test("cache serves the previous result until a capability file changes", async () => {
  const d = caps();
  const now = Date.now();
  await check(d, true, now);
  writeFileSync(join(d, "good.md").replace("good", "marker"), "no frontmatter\n");
  const cached = await check(d, false, now + 1000);
  expect(cached.find((r) => r.service === "good")!.state).toBe("green");
  writeFileSync(join(d, "good.md"), "---\nservice: good\nhealth: exit 1\n---\n");
  const after = await check(d, false, now + 2000);
  expect(after.find((r) => r.service === "good")!.state).toBe("red");
});
