#!/bin/bash
# session-start-doctor.sh: at session start, runs the capability doctor and puts every failing capability
# into the session's context, so the agent knows which services are down before it relies on them.
#
# Why: in the setup this was derived from, the expensive failures were sessions that built on a service
# whose access had silently broken (an expired token, a moved host) and found out several steps later.
# One line per red capability at the start costs a few tokens; nothing is added when all are green.
# Interface: `bun <doctor.ts> --red-only` prints one line per failing capability, nothing when all are
# green, and exits 0. Silent, exit 0, when bun or the script is missing or the doctor prints nothing.
# DOCTOR_SCRIPT and DOCTOR_BUN override the paths (tests).
# Wiring: settings.json hooks.SessionStart (no matcher), with a timeout.
# Test: bash tests/session-start-doctor.test.sh
DOCTOR="${DOCTOR_SCRIPT:-$HOME/.claude/scripts/doctor.ts}"
BUN="${DOCTOR_BUN:-bun}"
cat >/dev/null  # the SessionStart payload is not needed
command -v "$BUN" >/dev/null 2>&1 || exit 0
[ -f "$DOCTOR" ] || exit 0
OUT=$("$BUN" "$DOCTOR" --red-only 2>/dev/null)
[ -z "$OUT" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0
jq -n --arg c "Capability doctor, failing at session start (fix or route around these before relying on them):
$OUT" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}'
exit 0
