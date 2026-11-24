# Jig website: a static Astro site (site/), served by nginx. Coolify builds this Dockerfile from the repo
# root on push to main and fronts it with TLS for jig.shelfwood.co. The design system is the published npm
# package @j_shelfwood/talos-ui (exact version in site/package.json, lockfile-pinned), so `bun install`
# below needs the npm registry reachable at build time.

# ---- build stage ----------------------------------------------------------
FROM oven/bun:1.2 AS build
WORKDIR /app

# Install deps with the lockfile for reproducible builds. Copy manifests first so the dependency layer
# caches independently of content changes.
COPY package.json bun.lock ./
COPY site/package.json site/
RUN bun install --frozen-lockfile

# Copy the rest and build the static site. The pages are rendered from docs/, so it is part of the context.
COPY . .
RUN bun run build

# ---- serve stage ----------------------------------------------------------
FROM nginx:1.27-alpine AS serve
# Copy the built site FROM the build stage (not the host context: site/dist is gitignored and
# dockerignored, and only exists inside the build stage after `bun run build`).
COPY --from=build /app/site/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
EXPOSE 80
# NOTE: deliberately NO Dockerfile HEALTHCHECK. Coolify caches custom_healthcheck_found and then wedges
# rolling updates on every later deploy. Coolify does its own container health probing.
