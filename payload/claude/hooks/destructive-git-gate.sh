#!/bin/bash
# destructive-git-gate.sh: `git reset --hard` and `git clean` ask first, in every checkout.
#
# Why: both discard uncommitted work with no undo. In the setup this was derived from, the gate moved
# from two `permissions.ask` rules into a hook, because an ask rule beats any hook decision, so an
# exception (there: linked worktrees that only hold one agent lane's own work) can only live in a hook.
# This version always asks; add an exception here if you run agents in disposable worktrees.
# Matches each shell segment, also after `git -C <dir>`; `git clean -n` (dry run) asks too.
# Wiring: settings.json hooks.PreToolUse, matcher "Bash".
# Test: bash tests/destructive-git-gate.test.sh
ask() { jq -n --arg r "destructive-git-gate: $1 discards uncommitted work; confirm" \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'; exit 0; }
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null) || exit 0
SEGS=$(printf '%s\n' "$CMD" | tr ';&|' '\n\n\n')
GIT='(^|[ (`])git( +-[Cc] +[^ ]+)*'
printf '%s\n' "$SEGS" | grep -Eq "$GIT +reset( .*)? --hard( |\$)" && ask "git reset --hard"
printf '%s\n' "$SEGS" | grep -Eq "$GIT +clean( |\$)" && ask "git clean"
exit 0
