import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import remarkWikilinks from "./src/plugins/remark-wikilinks.ts";
import remarkCallouts from "./src/plugins/remark-callouts.ts";
import talosCodeTheme from "./talos-code-theme.mjs";

// The content is ../docs, a plain Obsidian folder that is also read on GitHub and in Obsidian itself. The
// two local remark plugins translate its Obsidian syntax (wikilinks, callouts) at build time, so docs/
// needs no site-specific markup. Mermaid blocks are left unhighlighted and rendered in the browser by
// src/scripts/mermaid.ts.
const docsDir = fileURLToPath(new URL("../docs", import.meta.url));

export default defineConfig({
  site: "https://jig.shelfwood.co",
  build: { format: "directory" },
  // mermaid (with its diagram chunks) is the one large bundle; src/scripts/mermaid.ts imports it lazily,
  // only on pages with a diagram.
  vite: { build: { chunkSizeWarningLimit: 1500 } },
  markdown: {
    remarkPlugins: [[remarkWikilinks, { docsDir }], remarkCallouts],
    syntaxHighlight: { type: "shiki", excludeLangs: ["mermaid"] },
    // talos theme: every token colour is a var(--talos-code-*) defined in DocsShell, so code tracks the
    // Talos palette. The transformer puts the chamfer engine classes on every fenced <pre>, so code blocks
    // draw their cut like any other talos surface.
    shikiConfig: {
      theme: talosCodeTheme,
      transformers: [
        {
          pre(node) {
            this.addClassToHast(node, "talos-chamfer talos-chamfer--btn");
          },
        },
      ],
    },
  },
});
