// architecture.ts: the layer diagram, from the mermaid flowchart and the layer table in docs/architecture.md,
// plus the @imports and routing lines of payload/claude/CLAUDE.md.
//
// Nodes and edges come from the first ```mermaid block (`ID["label<br/>…"]`, `A -- "label" --> B`,
// `A -. "label" .-> B`). The landing page places nodes by id (site/src/components/scenes/Architecture.astro),
// so a node id it has no position for fails the build here.
import { ROOT, SourceError, readSource } from "./source.ts";

export const ARCH = "docs/architecture.md";
export const GLOBAL_CLAUDE = "payload/claude/CLAUDE.md";

export type ArchNode = { id: string; title: string; lines: string[] };
export type ArchEdge = { from: string; to: string; label: string; dashed: boolean };
export type Layer = { layer: string; files: string; loads: string; owns: string };
export type Architecture = {
  nodes: ArchNode[];
  edges: ArchEdge[];
  layers: Layer[];
  imports: string[];
  routing: string[];
};

export function parseMermaid(src: string, file = ARCH): { nodes: ArchNode[]; edges: ArchEdge[] } {
  const block = /```mermaid\n([\s\S]*?)\n```/.exec(src)?.[1];
  if (!block) throw new SourceError(file, "no mermaid block");
  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  for (const raw of block.split("\n").map((l) => l.trim())) {
    const n = /^(\w+)\["(.+)"\]$/.exec(raw);
    if (n) {
      const [title, ...lines] = n[2]!.split("<br/>").map((s) => s.trim());
      nodes.push({ id: n[1]!, title: title!, lines });
      continue;
    }
    const e = /^(\w+)\s+(--|-\.)\s+"([^"]+)"\s+(-->|\.->)\s+(\w+)$/.exec(raw);
    if (e) edges.push({ from: e[1]!, to: e[5]!, label: e[3]!, dashed: e[2] === "-." });
  }
  if (nodes.length === 0) throw new SourceError(file, 'mermaid block has no `ID["label"]` nodes');
  for (const e of edges)
    if (!nodes.some((n) => n.id === e.from) || !nodes.some((n) => n.id === e.to))
      throw new SourceError(file, `edge ${e.from} -> ${e.to} names an undefined node`);
  return { nodes, edges };
}

export function parseLayers(src: string, file = ARCH): Layer[] {
  const sec = /^## Layer table\s*$([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(src)?.[1];
  if (!sec) throw new SourceError(file, 'no "## Layer table" section');
  const rows = sec.split("\n").filter((l) => /^\|.*\|\s*$/.test(l.trim())).slice(2);
  const layers = rows.map((r) => {
    const c = r.trim().slice(1, -1).split("|").map((x) => x.trim());
    if (c.length < 4) throw new SourceError(file, `layer row has ${c.length} cells, expected 4: ${r}`);
    return { layer: c[0]!, files: c[1]!, loads: c[2]!, owns: c[3]! };
  });
  if (!layers.length) throw new SourceError(file, "layer table is empty");
  return layers;
}

export function parseGlobalClaude(src: string, file = GLOBAL_CLAUDE): { imports: string[]; routing: string[] } {
  const imports = [...src.matchAll(/^@\S+\/([^/\s]+\.md)$/gm)].map((m) => m[1]!);
  if (!imports.length) throw new SourceError(file, "no @imports");
  const sec = /^## Routing[^\n]*\n([\s\S]*?)(?=^## )/m.exec(src)?.[1];
  if (!sec) throw new SourceError(file, 'no "## Routing" section');
  const routing = sec.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  if (!routing.length) throw new SourceError(file, "routing section has no lines");
  return { imports, routing };
}

export function loadArchitecture(root = ROOT): Architecture {
  const arch = readSource(ARCH, root);
  return { ...parseMermaid(arch), layers: parseLayers(arch), ...parseGlobalClaude(readSource(GLOBAL_CLAUDE, root)) };
}

/**
 * Where the landing diagram places each mermaid node (percent of the stage: desktop x,y and phone x,y) and
 * which rows of the layer table its detail panel shows. A node the mermaid block gains or loses, or a layer
 * row that was renamed, fails the build until this table follows.
 */
export const NODE_VIEW: Record<string, { at: [number, number, number, number]; layers: string[]; icon: string }> = {
  CM: { at: [40, 12, 50, 6], layers: ["global assembly"], icon: "lucide:file-cog" },
  AG: { at: [13, 50, 25, 27], layers: ["working principles", "machine context", "about me"], icon: "lucide:at-sign" },
  OD: { at: [40, 50, 75, 27], layers: ["skills", "capabilities", "repo rules"], icon: "lucide:book-open" },
  W: { at: [70, 50, 50, 58], layers: ["typed agents"], icon: "lucide:users" },
  H: { at: [87, 14, 25, 89], layers: ["hooks"], icon: "lucide:shield" },
  V: { at: [70, 88, 75, 89], layers: ["vault"], icon: "lucide:database" },
};

export function checkView(a: Pick<Architecture, "nodes" | "layers">, view = NODE_VIEW): void {
  for (const n of a.nodes)
    if (!view[n.id]) throw new SourceError(ARCH, `mermaid node ${n.id} ("${n.title}") has no place in the landing diagram (NODE_VIEW in site/scripts/kit/architecture.ts)`);
  for (const [id, v] of Object.entries(view)) {
    if (!a.nodes.some((n) => n.id === id)) throw new SourceError(ARCH, `the landing diagram expects mermaid node ${id}, which the flowchart no longer has`);
    for (const l of v.layers)
      if (!a.layers.some((x) => x.layer === l)) throw new SourceError(ARCH, `layer table has no row "${l}" (the landing diagram shows it under ${id})`);
  }
}
