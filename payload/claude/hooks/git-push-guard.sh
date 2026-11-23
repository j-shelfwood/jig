#!/bin/bash
# git-push-guard.sh: a push that is forced, deletes a branch, pushes tags, or targets a protected branch
# asks first. A feature-branch push passes without a prompt.
#
# Why: pushes to feature branches are reversible and were almost never rejected when asked (2 of 119 in
# Joris's transcripts), so asking every time was noise. These four forms are not reversible or reach
# production, so they keep the prompt.
# Wiring: settings.json hooks.PreToolUse, matcher "Bash".
# Test: echo '{"tool_name":"Bash","tool_input":{"command":"git push --force origin feat"}}' | ./git-push-guard.sh
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
echo "$CMD" | grep -Eq '(^|[;&| ])git( -C [^ ]+)? push' || exit 0

REASON=""
echo "$CMD" | grep -Eq -- '(--force|-f( |$)|--force-with-lease|\+[A-Za-z0-9_/.-]+)' && REASON="force push"
echo "$CMD" | grep -Eq -- '(--delete|-d | :[A-Za-z0-9_/.-]+( |$))' && REASON="branch delete"
echo "$CMD" | grep -Eq -- '(--tags|--follow-tags| v[0-9])' && REASON="tag push"
echo "$CMD" | grep -Eq -- '(^| |:)(main|master|production|release)( |$)' && REASON="push to a protected branch"

[ -z "$REASON" ] && exit 0
jq -n --arg r "git-push-guard: $REASON needs confirmation" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
exit 0
