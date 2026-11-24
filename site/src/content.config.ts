import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// The docs pages are ../docs/*.md at the repository root (the method, architecture, ...), kept as plain
// Obsidian notes. Entry ids are the file names ("index", "method"), routed by src/pages/docs/[...slug].astro.
const docs = defineCollection({
  loader: glob({ pattern: "*.md", base: "../docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { docs };
