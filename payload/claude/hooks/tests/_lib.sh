#!/bin/bash
# Shared helpers for hooks/tests/*.test.sh. Each suite sets HOOK, calls check, then ends with `finish`.
# decision <json>: prints deny | ask | block | context | empty for a hook's stdout.
pass=0; fail=0
decision() {
  [ -z "$1" ] && { echo empty; return; }
  printf '%s' "$1" | jq -r '
    if .hookSpecificOutput.permissionDecision then .hookSpecificOutput.permissionDecision
    elif .decision then .decision
    elif .hookSpecificOutput.additionalContext then "context"
    else "unknown" end' 2>/dev/null || echo invalid-json
}
# check <want> <label> <payload json>: runs $HOOK on the payload and compares the decision.
check() {
  OUT=$(printf '%s' "$3" | "$HOOK")
  got=$(decision "$OUT")
  if [ "$got" = "$1" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "  FAIL want $1 got $got: $2"; fi
}
# has <label> <text> <needle>: asserts the last hook output contains a string.
has() {
  case "$2" in *"$3"*) pass=$((pass+1)) ;; *) fail=$((fail+1)); echo "  FAIL $1: output lacks '$3'" ;; esac
}
finish() { echo "$(basename "$HOOK" .sh): $pass passed, $fail failed"; [ "$fail" = 0 ]; }
