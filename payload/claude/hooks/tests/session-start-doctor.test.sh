#!/bin/bash
# Cases for session-start-doctor.sh, with a stand-in for bun (no bun or doctor.ts needed).
# Usage: bash tests/session-start-doctor.test.sh [hook-path]
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_lib.sh"
HOOK="${1:-$DIR/../session-start-doctor.sh}"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# fake bun: prints the doctor file's content when called with --red-only, as `bun doctor.ts --red-only` would
printf '#!/bin/bash\n[ "$2" = "--red-only" ] && cat "$1"\nexit 0\n' > "$T/bun"; chmod +x "$T/bun"
printf 'github: gh auth status failed\nmail: token expired\n' > "$T/red.ts"
: > "$T/green.ts"
P='{"hook_event_name":"SessionStart","source":"startup"}'
export DOCTOR_BUN="$T/bun"
DOCTOR_SCRIPT="$T/red.ts" check context red-capabilities "$P"
OUT=$(printf '%s' "$P" | DOCTOR_SCRIPT="$T/red.ts" "$HOOK"); has lists-red "$OUT" "mail: token expired"
has event-name "$OUT" '"SessionStart"'
DOCTOR_SCRIPT="$T/green.ts" check empty all-green "$P"
DOCTOR_SCRIPT="$T/nope.ts" check empty missing-script "$P"
DOCTOR_BUN="$T/no-bun" DOCTOR_SCRIPT="$T/red.ts" check empty missing-bun "$P"
rc=$(printf '%s' "$P" | DOCTOR_BUN="$T/no-bun" "$HOOK" >/dev/null; echo $?)
[ "$rc" = 0 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "  FAIL missing-bun exit $rc"; }
finish
