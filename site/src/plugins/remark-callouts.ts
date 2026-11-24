// remark-callouts: render Obsidian callouts (`> [!type] Title`) as talos-ui alert blocks.
//
// The markup is the `.talos-alert` component of @j_shelfwood/talos-ui (talos-feedback.css): a chamfered
// panel with a status edge, an icon, a title and a body. Each Obsidian type maps onto one of the alert's
// status variants, so a callout carries no styling of its own. A blockquote without a `[!type]` marker
// stays a blockquote. The fold markers `+` and `-` are accepted and ignored (the site renders every
// callout open).
import type { Root, Parent, Blockquote, Paragraph, PhrasingContent, RootContent } from "mdast";

/** Obsidian callout type → talos-alert variant ("" is the neutral alert) and icon glyph. */
export const CALLOUT_TYPES: Record<string, { variant: string; icon: string }> = {
  note: { variant: "", icon: "≡" },
  abstract: { variant: "", icon: "≡" },
  summary: { variant: "", icon: "≡" },
  info: { variant: "info", icon: "i" },
  tip: { variant: "success", icon: "◆" },
  success: { variant: "success", icon: "✓" },
  question: { variant: "info", icon: "?" },
  warning: { variant: "warning", icon: "!" },
  failure: { variant: "danger", icon: "×" },
  danger: { variant: "danger", icon: "×" },
  bug: { variant: "danger", icon: "×" },
  example: { variant: "", icon: "≡" },
  quote: { variant: "", icon: "“" },
};

const MARKER = /^\[!([A-Za-z-]+)\]([+-]?)[ \t]*/;

const el = (hName: string, className: string[], children: any[], extra: Record<string, unknown> = {}) =>
  ({ type: "paragraph", data: { hName, hProperties: { className, ...extra } }, children }) as unknown as RootContent;

function toCallout(node: Blockquote): RootContent | undefined {
  const first = node.children[0];
  if (first?.type !== "paragraph") return undefined;
  const lead = first.children[0];
  if (lead?.type !== "text") return undefined;
  const m = lead.value.match(MARKER);
  if (!m) return undefined;
  const type = m[1].toLowerCase();
  const spec = CALLOUT_TYPES[type] ?? CALLOUT_TYPES.note;

  // The title runs from the marker to the first line break of the first paragraph; the rest of that
  // paragraph is the start of the body.
  const inline: PhrasingContent[] = [{ ...lead, value: lead.value.slice(m[0].length) }, ...first.children.slice(1)];
  const title: PhrasingContent[] = [];
  const rest: PhrasingContent[] = [];
  let inTitle = true;
  for (const child of inline) {
    if (!inTitle) { rest.push(child); continue; }
    if (child.type === "text" && child.value.includes("\n")) {
      const nl = child.value.indexOf("\n");
      if (nl > 0) title.push({ type: "text", value: child.value.slice(0, nl) });
      if (nl + 1 < child.value.length) rest.push({ type: "text", value: child.value.slice(nl + 1) });
      inTitle = false;
    } else if (child.type === "break") {
      inTitle = false;
    } else {
      title.push(child);
    }
  }
  const titleChildren = title.length && !(title.length === 1 && title[0].type === "text" && !title[0].value.trim())
    ? title
    : [{ type: "text", value: type.charAt(0).toUpperCase() + type.slice(1) }];
  const body: RootContent[] = [
    ...(rest.length ? [{ type: "paragraph", children: rest } as Paragraph] : []),
    ...node.children.slice(1),
  ];

  return el("aside", ["callout", "talos-alert", ...(spec.variant ? [`talos-alert--${spec.variant}`] : [])], [
    el("span", ["talos-alert__icon"], [{ type: "text", value: spec.icon }], { ariaHidden: "true" }),
    el("div", ["talos-alert__title"], titleChildren),
    el("div", ["talos-alert__body"], body),
  ], { dataCallout: type });
}

export default function remarkCallouts() {
  return (tree: Root) => {
    const visit = (node: Parent) => {
      node.children.forEach((child, i) => {
        if (child.type === "blockquote") {
          const callout = toCallout(child);
          if (callout) node.children[i] = callout as any;
        }
        if ("children" in node.children[i]) visit(node.children[i] as Parent);
      });
    };
    visit(tree);
  };
}
