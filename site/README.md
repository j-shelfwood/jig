# site

The website at [jig.shelfwood.co](https://jig.shelfwood.co/): a landing page at `/` and the method docs at `/docs/`. It is a static [Astro](https://astro.build) site on bun, styled with the `@j_shelfwood/talos-ui` design system (pinned to an exact version in `site/package.json`).

## Content

The docs pages are the Markdown files in `docs/` at the repository root, read through an Astro content collection (`site/src/content.config.ts`). `docs/` stays a plain Obsidian folder; two local remark plugins translate its Obsidian syntax at build time:

- `site/src/plugins/remark-wikilinks.ts`: `[[page]]`, `[[page|alias]]`, `[[page#Heading]]`, `[[page#Heading|alias]]` and `[[#Heading|alias]]` become links to `/docs/<page>/#<id>`, with the id computed the way Astro computes heading ids. A link to a missing page or heading fails the build.
- `site/src/plugins/remark-callouts.ts`: `> [!type] Title` callouts become talos-ui alert blocks.

Mermaid code blocks are rendered in the browser by the bundled `mermaid` package (`site/src/scripts/mermaid.ts`). The sidebar order and labels live in `site/src/docs-nav.ts`; a new page in `docs/` needs a line there, or the build fails.

## Develop

```sh
bun install                           # from the repository root (a bun workspace)
bun run dev                           # astro dev on :4321
bun run build                         # static build into site/dist
bun test site/src                     # plugin tests
bun site/scripts/check-links.ts       # every internal link and #anchor in site/dist resolves
```

## Docker

```sh
docker build -t jig-site .
docker run --rm -p 8080:80 jig-site   # http://localhost:8080
```

The root `Dockerfile` builds with bun and serves `site/dist` with nginx (`deploy/nginx.conf`): directory URLs with a trailing slash, an honest 404 status with the styled 404 page, long caching for fingerprinted assets.

## Deploy

Coolify builds the root `Dockerfile` on every push to `main` and serves it at jig.shelfwood.co. There is no separate deploy step.
