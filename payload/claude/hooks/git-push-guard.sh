#!/bin/bash
# git-push-guard.sh: a push that is forced, deletes a branch, pushes tags, or targets a protected branch
# asks first. A feature-branch push passes without a prompt.
#
# Why: in the setup this was derived from, pushes to feature branches were almost never rejected when
# asked (2 of 119 in 30 days of transcripts), so asking every time was noise. These four forms are not
# reversible or reach production, so they keep the prompt.
# Only the `git push` segments of a command are inspected, so `rm -f x && git push origin feat` passes.
# Protected branches: PROTECTED below (whole ref names, so `maintenance` is not `main`).
# Wiring: settings.json hooks.PreToolUse, matcher "Bash".
# Test: bash tests/git-push-guard.test.sh
PROTECTED='main|master|production|release'
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
# one line per shell segment (split on ; & | and newlines), keep the git push segments
PUSH=$(printf '%s\n' "$CMD" | tr ';&|' '\n\n\n' | grep -E '(^|[ (`])git( +-[Cc] +[^ ]+)* +push( |$)')
[ -z "$PUSH" ] && exit 0
# pad with spaces so every token is bounded by a space on both sides
P=" $(printf '%s' "$PUSH" | tr '\n' ' ') "

REASON=""
printf '%s' "$P" | grep -Eq -- ' (--force|--force-with-lease(=[^ ]*)?|--mirror|-[a-zA-Z]*f[a-zA-Z]*) | \+[^ ]+ ' && REASON="force push"
printf '%s' "$P" | grep -Eq -- ' (--delete|-d) | :[^ ]+ ' && REASON="branch delete"
printf '%s' "$P" | grep -Eq -- ' (--tags|--follow-tags) |refs/tags/| v[0-9]+(\.[0-9]+)* ' && REASON="tag push"
printf '%s' "$P" | grep -Eq -- "[ :/]($PROTECTED) " && REASON="push to a protected branch"

[ -z "$REASON" ] && exit 0
jq -n --arg r "git-push-guard: $REASON needs confirmation" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
exit 0
