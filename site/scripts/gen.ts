#!/usr/bin/env bun
// gen.ts: derive every landing-page scene from the repository and write site/src/generated/kit.json.
//
// Run by `bun run build` and `bun run dev` (site/package.json) before Astro, so the page always shows the kit
// as it is in this checkout: the loop from docs/method.md, the workers from payload/claude/agents, the hooks
// from payload/claude/settings.json and their own output on fixtures, the task grammar from vault-schema.md,
// the layers from docs/architecture.md, and terminal output from agent-queue.ts, vault-lint.ts and trace.ts
// run against a demo vault built from payload/vault/Templates. A source that no longer parses fails the
// build with `gen: <file>: <what is missing>`.
//
// Needs: bun, bash, jq (the hooks), git (the demo vault is a git repo, for vault-lint's uncommitted count).
// Usage: bun site/scripts/gen.ts [--out <file>]
import { mkdirSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { loadMethod, step, inlineHtml } from "./kit/method.ts";
import { loadAgents, verdicts } from "./kit/agents.ts";
import { loadHooks, runHook, runHookTests, hookByName, type Hook } from "./kit/hooks.ts";
import { loadSchema } from "./kit/schema.ts";
import { loadArchitecture, checkView, NODE_VIEW } from "./kit/architecture.ts";
import { loadReadme } from "./kit/readme.ts";
import { runDemo, REQUEST, PROJECT, TODAY, DECISION, taskLine } from "./kit/demo.ts";
import { lanes, verify, DECIDE } from "./kit/story.ts";
import { ROOT, SourceError, frontmatter, need, readSource } from "./kit/source.ts";

/** Counts shown in the strip under the hero, each from the same source its scene uses. */
export function counts(root = ROOT, agents = loadAgents(root).length, hooks = loadHooks(root).length) {
  const scriptsDir = join(root, "payload/claude/scripts");
  const scripts = readdirSync(scriptsDir).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && readSource(`payload/claude/scripts/${f}`, root).includes("import.meta.main"),
  ).length;
  const skillsDir = join(root, "payload/claude/skills");
  const skills = readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, "SKILL.md"))).length;
  const placeholders = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else for (const m of readSource(p.slice(root.length + 1), root).matchAll(/<<[A-Z_]+>>/g)) placeholders.add(m[0]);
    }
  };
  walk(join(root, "payload"));
  return [
    { n: agents, label: "typed workers", href: "#roster" },
    { n: hooks, label: "hooks", href: "#guardrails" },
    { n: scripts, label: "scripts", href: "#record" },
    { n: skills, label: "skills", href: "#architecture" },
    { n: placeholders.size, label: "interview fields", href: "#quick-start" },
  ];
}

/** The parenthesised list in step 5's paragraph: what reaches you as a question. */
function askedKinds(bodyHtml: string): string[] {
  const m = /\(([^)]+)\)/.exec(bodyHtml.replace(/<[^>]+>/g, ""));
  if (!m) throw new SourceError("docs/method.md", 'step 5 no longer lists what is asked in parentheses, e.g. "(a message to a person, spend, …)"');
  return m[1]!.split(/,\s*/).map((s) => s.replace(/^an? /, "").trim());
}

export function generate() {
  const steps = loadMethod();
  const roster = loadAgents();
  const hooks = loadHooks();
  const schema = loadSchema();
  const arch = loadArchitecture();
  checkView(arch);
  const readme = loadReadme();
  const skills = readdirSync(join(ROOT, "payload/claude/skills")).filter((d) => existsSync(join(ROOT, "payload/claude/skills", d, "SKILL.md"))).sort();
  const items: Record<string, string[]> = {
    CM: arch.routing.map((r) => inlineHtml(r)),
    AG: arch.imports.map((f) => `<code>${f}</code>`),
    OD: skills.map((s) => `<code>skills/${s}/SKILL.md</code>`),
    W: roster.map((w) => `<code>${w.name}</code> ${w.model}`),
    H: hooks.map((h) => `<code>${h.name}</code> ${h.decisions.join(" / ")}`),
    V: schema.folders.map((f) => `${inlineHtml(f.folder.includes("`") ? f.folder : "`" + f.folder + "`")} ${inlineHtml(f.purpose)}`),
  };
  const archNodes = arch.nodes.map((n) => {
    const v = NODE_VIEW[n.id]!;
    return {
      ...n,
      at: v.at,
      icon: v.icon,
      layers: v.layers.map((name) => {
        const l = arch.layers.find((x) => x.layer === name)!;
        return { layer: l.layer, files: inlineHtml(l.files), loads: inlineHtml(l.loads), owns: inlineHtml(l.owns) };
      }),
      items: items[n.id] ?? [],
    };
  });
  const demo = runDemo();

  const pushGuard = hookByName(hooks, "git-push-guard");
  const typedSpawn = hookByName(hooks, "no-general-purpose-agent");
  const branch = "feat/email-receipt";
  const pushPasses = (() => {
    const input = { tool_name: "Bash", tool_input: { command: `git push -u origin ${branch}` } };
    try {
      runHook(pushGuard, input);
    } catch (e) {
      if (String((e as Error).message).includes("printed nothing")) return true;
      throw e;
    }
    throw new SourceError(pushGuard.file, `now prompts on a feature-branch push (git push -u origin ${branch}); the decide scene says it passes`);
  })();
  const blocks = [
    { label: "a force push", call: `Bash(git push --force origin ${branch})`, run: runHook(pushGuard, { tool_name: "Bash", tool_input: { command: `git push --force origin ${branch}` } }) },
    { label: "an untyped spawn", call: 'Agent(subagent_type: "general-purpose")', run: runHook(typedSpawn, { tool_name: "Agent", tool_input: { subagent_type: "general-purpose", prompt: "fix the checkout" } }) },
  ];
  const hookRow = (h: Hook) => ({ name: h.name, event: h.event, matcher: h.matcher, what: h.what, why: h.why, decisions: h.decisions, file: h.file });

  return {
    generatedFrom: "site/scripts/gen.ts",
    steps,
    counts: counts(ROOT, roster.length, hooks.length),
    roster,
    hooks: hooks.map(hookRow),
    schema,
    arch: {
      description: need("docs/architecture.md", frontmatter(readSource("docs/architecture.md"))?.description, 'frontmatter "description"'),
      nodes: archNodes,
      edges: arch.edges,
    },
    readme,
    demo: {
      project: PROJECT,
      today: TODAY,
      request: REQUEST,
      taskOpen: taskLine("open"),
      taskDone: taskLine("done"),
      decision: DECISION,
      vault: demo.vault,
      runs: { queue: demo.queue, lintBefore: demo.lintBefore, lintAfter: demo.lintAfter, clusters: demo.clusters },
    },
    scenes: {
      intake: { step: step(steps, 1), shape: step(steps, 2) },
      dispatch: { step: step(steps, 3), prompt: `work the ready queue for ${PROJECT}`, lanes: lanes(roster, demo.queue.out) },
      verify: { step: step(steps, 4), ...verify(verdicts(roster)) },
      decide: {
        step: step(steps, 5),
        ...DECIDE,
        asked: askedKinds(step(steps, 5).body),
        done: [
          { what: `commit 3f2a91c on ${branch}`, undo: "git revert 3f2a91c" },
          { what: `push ${branch} (git-push-guard: ${pushPasses ? "no prompt" : "asks"})`, undo: `git push origin --delete ${branch}` },
          { what: "draft PR #14", undo: "gh pr close 14" },
        ],
      },
      record: { step: step(steps, 6) },
      retro: {
        step: step(steps, 7),
        fix: { hook: pushGuard.name, why: pushGuard.why, what: pushGuard.what, tests: runHookTests(pushGuard) },
        blocks: blocks.map((b) => ({ ...b, tests: runHookTests(hookByName(hooks, b.run.hook)) })),
      },
    },
    inline: { schemaTags: schema.tags.map((t) => ({ tag: t.tag.replace(/`/g, ""), meaning: inlineHtml(t.meaning.replace(/<<NAME>>/g, "you")) })) },
  };
}

export type Kit = ReturnType<typeof generate>;

if (import.meta.main) {
  const { values } = parseArgs({ options: { out: { type: "string", default: join(import.meta.dir, "..", "src", "generated", "kit.json") } } });
  try {
    const t0 = performance.now();
    const kit = generate();
    mkdirSync(dirname(values.out!), { recursive: true });
    writeFileSync(values.out!, JSON.stringify(kit, null, 1) + "\n");
    console.log(
      `gen: ${kit.steps.length} steps, ${kit.roster.length} workers, ${kit.hooks.length} hooks, ` +
        `${kit.scenes.dispatch.lanes.length} lanes → ${values.out!.slice(ROOT.length + 1)} (${Math.round(performance.now() - t0)} ms)`,
    );
  } catch (e) {
    if (e instanceof SourceError) {
      console.error(`gen: ${e.message}`);
      console.error("gen: the landing page is generated from this file; fix the file or the parser in site/scripts/kit/.");
      process.exit(1);
    }
    throw e;
  }
}
