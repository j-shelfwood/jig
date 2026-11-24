#!/usr/bin/env bash
# build.sh: build the website into public/ (landing page at /, Quartz-rendered docs/ at /docs/).
#
# Quartz is not vendored: it is cloned at a pinned commit into a cache folder outside the repository
# (default ~/.cache/agent-setup-blueprint/quartz-<tag>, override with QUARTZ_DIR) on first run. It stays
# outside the repository because scripts/check.ts scans every file in the tree, and Quartz's own files
# carry addresses and em dashes.
# docs/ stays a plain Obsidian folder; it is staged into Quartz's content folder on every build, with
# site/content/index.md as the docs home page while docs/ has no index.md of its own.
#
# Usage: bash site/build.sh          needs git and Node >= 22 (Quartz's engines field)
set -euo pipefail

QUARTZ_REPO="https://github.com/jackyzha0/quartz.git"
QUARTZ_TAG="v4.5.2"
QUARTZ_COMMIT="4923affa7722dfc751f1074348e6dad214fe0c08"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/site"
QUARTZ="${QUARTZ_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/agent-setup-blueprint/quartz-$QUARTZ_TAG}"
OUT="$ROOT/public"

if [ ! -d "$QUARTZ/.git" ]; then
  mkdir -p "$(dirname "$QUARTZ")"
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$QUARTZ_TAG" "$QUARTZ_REPO" "$QUARTZ"
fi
actual="$(git -C "$QUARTZ" rev-parse HEAD)"
if [ "$actual" != "$QUARTZ_COMMIT" ]; then
  echo "build.sh: $QUARTZ is at $actual, expected $QUARTZ_COMMIT ($QUARTZ_TAG); delete it and rerun" >&2
  exit 1
fi

if [ ! -d "$QUARTZ/node_modules" ]; then
  (cd "$QUARTZ" && npm ci --no-audit --no-fund --loglevel=error)
fi

cp "$SITE/quartz.config.ts" "$SITE/quartz.layout.ts" "$QUARTZ/"

# Stage docs/ as Quartz content. Each file's mtime is set to its last commit date, because the
# staged copy is outside our git history and Quartz reads the modified date from the filesystem.
CONTENT="$QUARTZ/content"
rm -rf "$CONTENT"
mkdir -p "$CONTENT"
cp -R "$ROOT/docs/." "$CONTENT/"
[ -f "$CONTENT/index.md" ] || cp "$SITE/content/index.md" "$CONTENT/index.md"
(cd "$ROOT/docs" && find . -type f -name '*.md') | while IFS= read -r f; do
  stamp="$(TZ=UTC git -C "$ROOT" log -1 --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%cd -- "docs/${f#./}")"
  if [ -n "$stamp" ]; then touch -d "$stamp" "$CONTENT/${f#./}"; fi
done

rm -rf "$OUT"
(cd "$QUARTZ" && npx quartz build -d "$CONTENT" -o "$OUT/docs")
cp -R "$SITE/landing/." "$OUT/"
touch "$OUT/.nojekyll"
echo "build.sh: site written to public/"
