// Render the docs' ```mermaid blocks in the browser with the bundled mermaid package (no CDN).
//
// astro.config.mjs excludes "mermaid" from shiki, so each diagram arrives as <pre><code
// class="language-mermaid">. The <pre> is replaced by a chamfered talos surface and drawn with mermaid's
// "base" theme fed from the talos tokens. Talos is a dark-only system (color-scheme: dark), so the
// diagrams are always drawn dark. mermaid is imported lazily: pages without a diagram never load it.
export async function renderMermaid(): Promise<void> {
  const blocks = [...document.querySelectorAll<HTMLElement>("pre > code.language-mermaid")];
  if (blocks.length === 0) return;

  const nodes = blocks.map((code) => {
    const pre = code.parentElement!;
    const div = document.createElement("div");
    div.className = "mermaid-diagram talos-chamfer talos-chamfer--md";
    div.textContent = code.textContent ?? "";
    pre.replaceWith(div);
    return div;
  });

  // Hex values of the talos tokens (tokens.css): mermaid derives shades from these colours with its own
  // colour parser, which reads hex reliably but not the space-separated hsl() syntax the tokens use.
  const fg = "#ffffff"; // --talos-foreground
  const surface1 = "#0a0a0a"; // --talos-surface-1
  const surface2 = "#121212"; // --talos-surface-2
  const edge = "#666666"; // --talos-edge-strong over black
  const muted = "#999999"; // --talos-muted-foreground
  const font = getComputedStyle(document.documentElement).getPropertyValue("--talos-font-display").trim() || "system-ui";

  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    darkMode: true,
    fontFamily: font,
    themeVariables: {
      darkMode: true,
      background: surface1,
      fontSize: "14px",
      primaryColor: surface2,
      primaryTextColor: fg,
      primaryBorderColor: edge,
      secondaryColor: surface2,
      tertiaryColor: surface2,
      lineColor: muted,
      textColor: fg,
      edgeLabelBackground: surface1,
      clusterBkg: surface1,
      clusterBorder: edge,
      actorBkg: surface2,
      actorBorder: edge,
      actorTextColor: fg,
      signalColor: fg,
      signalTextColor: fg,
      noteBkgColor: surface2,
      noteTextColor: fg,
      noteBorderColor: edge,
    },
  });
  await mermaid.run({ nodes });
}
