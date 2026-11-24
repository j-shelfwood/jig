# site

The website at [jig.shelfwood.co](https://jig.shelfwood.co/): a landing page at `/` and the method docs at `/docs/`. It is a static [Astro](https://astro.build) site on bun, styled with the `@j_shelfwood/talos-ui` design system (pinned to an exact version in `site/package.json`).

## Content

The docs pages are the Markdown files in `docs/` at the repository root, read through an Astro content collection (`site/src/content.config.ts`). `docs/` stays a plain Obsidian folder; two local remark plugins translate its Obsidian syntax at build time:

- `site/src/plugins/remark-wikilinks.ts`: `[[page]]`, `[[page|alias]]`, `[[page#Heading]]`, `[[page#Heading|alias]]` and `[[#Heading|alias]]` become links to `/docs/<page>/#<id>`, with the id computed the way Astro computes heading ids. A link to a missing page or heading fails the build.
- `site/src/plugins/remark-callouts.ts`: `> [!type] Title` callouts become talos-ui alert blocks.

Mermaid code blocks are rendered in the browser by the bundled `mermaid` package (`site/src/scripts/mermaid.ts`). The sidebar order and labels live in `site/src/docs-nav.ts`; a new page in `docs/` needs a line there, or the build fails.

## Landing page: generated from the kit

The landing page (`site/src/pages/index.astro`) replays one session on a made-up web shop, Acme Kiosk, in animated scenes. None of its content is copied by hand: `site/scripts/gen.ts` runs before every `astro dev` and `astro build` and writes `site/src/generated/kit.json` (gitignored), which the scene components in `site/src/components/scenes/` render.

| on the page | derived from | by |
|---|---|---|
| loop ring, scene titles and captions, "leaves behind / prevents / in the kit" | `docs/method.md`, the `### <n> <Step>` sections under `## The loop` | `site/scripts/kit/method.ts` |
| worker chips, models, tools, the roster | `payload/claude/agents/*.md` frontmatter | `kit/agents.ts` |
| verifier verdict words | the verifier's description ("returns A, B or C") | `kit/agents.ts` |
| hook table (event, matcher, what, why, decisions) | `payload/claude/settings.json` wiring plus each hook's header comment | `kit/hooks.ts` |
| hook messages in the retro scene | the hook scripts, run on fixture payloads at build time | `kit/hooks.ts` `runHook` |
| hook test results | `payload/claude/hooks/tests/<hook>.test.sh`, run at build time | `kit/hooks.ts` `runHookTests` |
| tracker, decision note, handoff, daily note | a demo vault built from `payload/vault/Templates/*.md` in a temp folder, in three states | `kit/demo.ts` |
| `agent-queue.ts`, `vault-lint.ts`, `trace.ts clusters` output | the scripts in `payload/claude/scripts/`, run on that demo vault and on synthetic transcripts | `kit/demo.ts` |
| tag legend, vault folders | `payload/vault/Constitution/vault-schema.md` §1 and §3 | `kit/schema.ts` |
| architecture diagram and its panels | the mermaid flowchart and layer table in `docs/architecture.md`, the `@` imports and routing lines of `payload/claude/CLAUDE.md` | `kit/architecture.ts` |
| counts strip | the same sources (workers, wired hooks, scripts with a main, skills, `<<PLACEHOLDER>>` names in `payload/`) | `gen.ts` `counts` |
| quick start, principles | `README.md` `## Quick start` and `## The ideas in one screen` | `kit/readme.ts` |

The story text (what the shop owner asked, what each lane reported) lives in `kit/demo.ts` and `kit/story.ts`; everything it relies on is checked against the kit (a worker it names must exist, the lanes are the tasks `agent-queue.ts` listed, the verdicts are the verifier's).

When a source no longer has the shape a parser needs (a renamed heading, a missing frontmatter key, a hook that stopped printing a reason, a new mermaid node with no place in the diagram), the build stops with one line naming the file:

```
gen: docs/method.md: no "## The loop" section
gen: the landing page is generated from this file; fix the file or the parser in site/scripts/kit/.
```

To regenerate: `bun run build` (or `bun site/scripts/gen.ts` alone). Generation needs bash, jq and git (the root `Dockerfile` installs them in its build stage). Tests: `bun test site/scripts`. There are no static images to regenerate: every scene is HTML, SVG and CSS.

Animation: each scene's resting style is its final frame; an inline script sets `html.motion` unless `prefers-reduced-motion` is on, and `site/src/scripts/scenes.ts` plays a scene when it scrolls into view (IntersectionObserver), with a Replay button. Only opacity, transform and clip-path animate (`site/src/styles/scenes.css`), so nothing shifts the layout.

## Develop

```sh
bun install                           # from the repository root (a bun workspace)
bun run dev                           # astro dev on :4321
bun run build                         # static build into site/dist
bun test site/src site/scripts       # plugin and generator tests
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

| field | value |
|---|---|
| domain | https://jig.shelfwood.co (A record at TransIP, set by hand) |
| Coolify | standalone application `jig`, uuid `ntoet0999q3vnh6csxzvmkb7`, project `shelfwood-services`, environment `production` |
| build | `dockerfile` build pack, `/Dockerfile`, port 80, Coolify health check off (no Dockerfile HEALTHCHECK, on purpose) |
| trigger | GitHub push webhook to Coolify's manual GitHub endpoint, with a shared secret set on both sides |
| TLS | Traefik with Let's Encrypt; a certificate request made before DNS resolved is not retried, so redeploy after a DNS change |
