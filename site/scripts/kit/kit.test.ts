// Tests for the landing-page generator: each parser reads the real source, and a broken copy of that source
// fails with a SourceError naming the file (the build's "fail loudly" contract).
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SourceError, readSource } from "./source.ts";
import { parseMethod, loadMethod, step } from "./method.ts";
import { loadAgents, parseAgent, verdicts, worker } from "./agents.ts";
import { loadHooks, parseHeader, runHook, hookByName } from "./hooks.ts";
import { parseSchema, loadSchema } from "./schema.ts";
import { loadArchitecture, parseMermaid, parseLayers, checkView } from "./architecture.ts";
import { parseReadme, loadReadme } from "./readme.ts";
import { demoVault, under, taskLine } from "./demo.ts";
import { queueTasks } from "./story.ts";
import { counts, generate } from "../gen.ts";

/** Asserts fn throws a SourceError whose message starts with `file` and contains `detail`. */
function fails(fn: () => unknown, file: string, detail: string | RegExp) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(SourceError);
    expect((e as SourceError).message.startsWith(`${file}: `)).toBe(true);
    expect((e as SourceError).message).toMatch(detail);
    return;
  }
  throw new Error(`expected a SourceError on ${file}`);
}

describe("method", () => {
  const src = readSource("docs/method.md");
  test("reads the loop steps with heading ids and bullets", () => {
    const steps = loadMethod();
    expect(steps.map((s) => s.n)).toEqual(steps.map((_, i) => i + 1));
    expect(steps[0]!.name).toBe("Intake");
    expect(steps[0]!.href).toBe("/docs/method/#1-intake");
    for (const s of steps) for (const k of ["body", "leaves", "prevents", "kit"] as const) expect(s[k].length).toBeGreaterThan(0);
    expect(steps[0]!.kit).toContain('href="/docs/architecture/#');
  });
  test("a renamed loop section fails naming docs/method.md", () => {
    fails(() => parseMethod(src.replace("## The loop", "## The cycle")), "docs/method.md", '"## The loop"');
  });
  test("a step without its Prevents bullet fails naming the step", () => {
    fails(() => parseMethod(src.replace("- **Prevents:** agents", "- agents")), "docs/method.md", /Shape.*Prevents/);
  });
  test("a scene for a step the loop no longer has fails", () => {
    fails(() => step(loadMethod(), 12), "docs/method.md", "step 12");
  });
});

describe("agents", () => {
  test("one worker per agent file, with model and tools", () => {
    const roster = loadAgents();
    expect(roster.length).toBe(readdirSync(join(ROOT, "payload/claude/agents")).filter((f) => f.endsWith(".md")).length);
    expect(worker(roster, "verifier").tools).toContain("Read");
    expect(worker(roster, "operator").toolMode).toBe("all except");
    expect(verdicts(roster)).toEqual(["REVERIFIED", "REFUTED", "UNDECIDABLE"]);
  });
  test("a missing model fails naming the file", () => {
    fails(() => parseAgent("---\nname: x\ndescription: y\n---\n", "payload/claude/agents/x.md"), "payload/claude/agents/x.md", '"model"');
  });
  test("a worker a scene needs but the kit lacks fails", () => {
    fails(() => worker(loadAgents(), "ghost"), "payload/claude/agents", '"ghost"');
  });
});

describe("hooks", () => {
  test("every wired hook has an event, a summary and a why", () => {
    const hooks = loadHooks();
    const wired = JSON.stringify(JSON.parse(readSource("payload/claude/settings.json")).hooks).match(/hooks\/[\w-]+\.sh/g)!;
    expect(hooks.length).toBe(wired.length);
    for (const h of hooks) expect([h.event, h.what, h.why].every(Boolean)).toBe(true);
  });
  test("a header without a Why paragraph fails naming the script", () => {
    fails(() => parseHeader("#!/bin/bash\n# x.sh: does x.\n#\n# Wiring: y\n", "payload/claude/hooks/x.sh"), "payload/claude/hooks/x.sh", "Why");
  });
  test("running the typed-spawn hook on a general-purpose spawn returns its deny reason", () => {
    const r = runHook(hookByName(loadHooks(), "no-general-purpose-agent"), { tool_name: "Agent", tool_input: { subagent_type: "general-purpose" } });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("typed");
  });
  test("a hook that prints nothing for its fixture fails naming the script", () => {
    const guard = hookByName(loadHooks(), "git-push-guard");
    fails(() => runHook(guard, { tool_name: "Bash", tool_input: { command: "git push origin feat/x" } }), guard.file, "printed nothing");
  });
});

describe("schema, architecture, readme", () => {
  test("task grammar and tags", () => {
    const s = loadSchema();
    expect(s.grammar[0]).toStartWith("- [ ]");
    expect(s.tags.map((t) => t.tag)).toContain("`#agent-ready`");
  });
  test("a schema without the tag table fails", () => {
    const src = readSource("payload/vault/Constitution/vault-schema.md").replace("| tag | meaning |", "| label | meaning |");
    fails(() => parseSchema(src), "payload/vault/Constitution/vault-schema.md", "tag");
  });
  test("diagram nodes, edges and layer rows line up with the landing layout", () => {
    const a = loadArchitecture();
    expect(a.nodes.length).toBeGreaterThan(3);
    expect(a.edges.some((e) => e.dashed)).toBe(true);
    checkView(a);
  });
  test("a new mermaid node without a place in the diagram fails", () => {
    const src = readSource("docs/architecture.md").replace('    CM -- "@import" --> AG', '    X["new layer"]\n    CM -- "@import" --> AG');
    fails(() => checkView({ ...parseMermaid(src), layers: parseLayers(src) }), "docs/architecture.md", "X");
  });
  test("README quick start and ideas", () => {
    const r = loadReadme();
    expect(r.commands.at(-1)).toBe("claude");
    expect(r.ideas.length).toBeGreaterThan(3);
    fails(() => parseReadme(readSource("README.md").replace("## Quick start", "## Getting started")), "README.md", "Quick start");
  });
});

describe("demo vault", () => {
  test("built from the templates in three states", () => {
    const P = "Projects/Acme Kiosk";
    expect(demoVault("before")[`${P}/tracker.md`]).not.toContain(taskLine("open"));
    expect(demoVault("shaped")[`${P}/tracker.md`]).toContain(taskLine("open"));
    const after = demoVault("after");
    expect(after[`${P}/tracker.md`]).toContain(taskLine("done"));
    expect(Object.keys(after).some((f) => f.includes("/decisions/"))).toBe(true);
    expect(JSON.stringify(after)).not.toMatch(/\{\{|<<[A-Z_]+>>/);
  });
  test("a template that lost its section fails naming the template", () => {
    fails(() => under("# T\n\n## Done\n", "Open", ["- [ ] x"], "payload/vault/Templates/Tracker.md"), "payload/vault/Templates/Tracker.md", '"## Open"');
  });
  test("queue output parses back to task texts", () => {
    expect(queueTasks("Projects/A/tracker.md:3 Do it #agent-ready done when: x ⏫\n# 1 ready")).toEqual(["Do it"]);
  });
});

test("counts are computed from the payload", () => {
  const c = Object.fromEntries(counts().map((x) => [x.label, x.n]));
  expect(c["typed workers"]).toBe(loadAgents().length);
  expect(c["hooks"]).toBe(loadHooks().length);
  expect(c["interview fields"]).toBeGreaterThan(0);
});

test("generate() fills every scene from the repository", () => {
  const kit = generate();
  expect(kit.scenes.dispatch.lanes.length).toBeGreaterThan(1);
  expect(kit.scenes.retro.blocks.map((b) => b.run.decision)).toEqual(["ask", "deny"]);
  expect(kit.demo.runs.queue.out).toContain("Email a receipt after checkout");
  expect(kit.demo.runs.lintAfter.out).toContain("0 stale-handoff");
}, 30000);

test("invalid settings.json fails naming the file", () => {
  const { mkdtempSync, cpSync, writeFileSync } = require("node:fs") as typeof import("node:fs");
  const { tmpdir } = require("node:os") as typeof import("node:os");
  const root = mkdtempSync(join(tmpdir(), "jig-settings-"));
  cpSync(join(ROOT, "payload/claude"), join(root, "payload/claude"), { recursive: true });
  writeFileSync(join(root, "payload/claude/settings.json"), "{,");
  expect(() => loadHooks(root)).toThrow(/^payload\/claude\/settings\.json: is not valid JSON/);
});
