// Tests for the two local remark plugins, run with `bun test site/src/plugins`.
// They render through the same unified chain Astro uses (remark-parse, remark-gfm, remark-smartypants,
// remark-rehype, rehype-stringify) against the real docs/ folder, so a renamed heading in docs/ shows up here too.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkSmartypants from "remark-smartypants";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkWikilinks from "./remark-wikilinks";
import remarkCallouts from "./remark-callouts";

const docsDir = join(import.meta.dir, "../../../docs");

const render = async (md: string, page = "method") =>
  String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkSmartypants)
      .use(remarkWikilinks, { docsDir })
      .use(remarkCallouts)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process({ value: md, path: join(docsDir, `${page}.md`) }),
  );

describe("remark-wikilinks", () => {
  test("bare page link uses the target's frontmatter title", async () => {
    expect(await render("See [[architecture]].")).toContain('<a href="/docs/architecture/">Architecture</a>');
  });
  test("alias", async () => {
    expect(await render("[[method|the method]]", "index")).toContain('<a href="/docs/method/">the method</a>');
  });
  test("index maps to /docs/", async () => {
    expect(await render("[[index|home]]")).toContain('<a href="/docs/">home</a>');
  });
  test("heading anchor uses Astro's heading id", async () => {
    expect(await render("[[architecture#The vault contract (short)|vault schema]]")).toContain(
      '<a href="/docs/architecture/#the-vault-contract-short">vault schema</a>',
    );
  });
  test("heading with punctuation and quotes", async () => {
    expect(await render('[[orchestration#3.3 The dispatch contract: "work as if nobody is watching"|x]]')).toContain(
      'href="/docs/orchestration/#33-the-dispatch-contract-work-as-if-nobody-is-watching"',
    );
  });
  test("same-page heading", async () => {
    expect(await render("[[#3.5 Events start agents: the fleet|3.5]]", "orchestration")).toContain(
      '<a href="#35-events-start-agents-the-fleet">3.5</a>',
    );
  });
  test("escaped pipe inside a GFM table cell", async () => {
    const html = await render("| a | b |\n|---|---|\n| [[orchestration\\|stage 3]] | x |");
    expect(html).toContain('<td><a href="/docs/orchestration/">stage 3</a></td>');
  });
  test("several links in one text node keep the text between them", async () => {
    expect(await render("Related: [[architecture]] · [[orchestration]]")).toContain(
      'Related: <a href="/docs/architecture/">Architecture</a> · <a href="/docs/orchestration/">Orchestration</a>',
    );
  });
  test("code is left alone", async () => {
    expect(await render("`[[method]]`")).toContain("<code>[[method]]</code>");
  });
  test("missing page fails", async () => {
    await expect(render("[[nope]]")).rejects.toThrow("no page docs/nope.md");
  });
  test("missing heading fails", async () => {
    await expect(render("[[method#Nope]]")).rejects.toThrow('no heading "Nope"');
  });
});

describe("remark-callouts", () => {
  test("title on the marker line, body after the line break", async () => {
    const html = await render("> [!abstract] The premise\n> Agents are **cheap**.");
    expect(html).toContain('<aside class="callout talos-alert" data-callout="abstract">');
    expect(html).toContain('<div class="talos-alert__title">The premise</div>');
    expect(html).toContain('<div class="talos-alert__body"><p>Agents are <strong>cheap</strong>.</p></div>');
  });
  test("type maps to the talos status variant", async () => {
    for (const [type, variant] of [["tip", "success"], ["info", "info"], ["warning", "warning"], ["failure", "danger"]]) {
      expect(await render(`> [!${type}] T\n> b`)).toContain(`class="callout talos-alert talos-alert--${variant}"`);
    }
  });
  test("list body and wikilinks inside the callout", async () => {
    const html = await render("> [!tip] Start here\n> 1. Read [[method|the method]].\n> 2. Two.", "index");
    expect(html).toContain('<div class="talos-alert__title">Start here</div>');
    expect(html).toMatch(/<div class="talos-alert__body">\s*<ol>/);
    expect(html).toContain('<a href="/docs/method/">the method</a>');
  });
  test("missing title falls back to the type name", async () => {
    expect(await render("> [!warning]\n> body")).toContain('<div class="talos-alert__title">Warning</div>');
  });
  test("plain blockquote stays a blockquote", async () => {
    expect(await render("> just a quote")).toContain("<blockquote>");
  });
});
