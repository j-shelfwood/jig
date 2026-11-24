// The docs sidebar and the prev/next order: the reading order of the method, overview first.
// Slugs are content-collection entry ids (file names in ../docs); every docs page must appear here
// (src/pages/docs/[...slug].astro fails the build for a page that is missing).
export interface DocsNavItem {
  label: string;
  slug: string;
}

export const docsNav: DocsNavItem[] = [
  { label: "Overview", slug: "index" },
  { label: "The method", slug: "method" },
  { label: "Architecture", slug: "architecture" },
  { label: "Prompting strategies", slug: "prompting-strategies" },
  { label: "Orchestration", slug: "orchestration" },
  { label: "Install", slug: "install" },
];

/** "/docs/" for the index entry, "/docs/method/" for the rest. */
export const docsHref = (slug: string) => (slug === "index" ? "/docs/" : `/docs/${slug}/`);
