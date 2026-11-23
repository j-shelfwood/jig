#!/bin/bash
# no-general-purpose-agent.sh: an Agent-tool spawn names a typed worker.
#
# Why (in the setup this was derived from, 681 spawns in 30 days): 595 were general-purpose. Output styles do not reach
# subagents, so those workers returned unstructured prose (median 5.5k, p90 14k characters). The report
# contract lives in agents/<name>.md, so the spawn must name one.
# Wiring: settings.json hooks.PreToolUse, matcher "Agent".
# Test: bash tests/no-general-purpose-agent.test.sh
INPUT=$(cat)
TYPE=$(echo "$INPUT" | jq -r '.tool_input.subagent_type // ""' 2>/dev/null) || exit 0
case "$TYPE" in
  general-purpose|"")
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Agent spawns are typed: subagent_type scout (read-only discovery, counts first), operator (execute in a workspace), verifier (re-derive one claim with another instrument) or vault-scribe (vault writes). Untyped spawns return unstructured reports (hooks/no-general-purpose-agent.sh)."}}
JSON
    ;;
esac
exit 0
