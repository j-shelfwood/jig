#!/bin/bash
# operator-done-gate.sh: an operator worker whose final report says `Status: Done` but has no
# `Grounding:` line is sent back once to add it (the report contract in agents/operator.md).
#
# Why: in the setup this was derived from, 1,215 operator transcripts over a month showed that 41% of
# editing operators ran no probe before their first edit, and 24% read a named dependency's source before
# writing against it; prose rules in agents/*.md held at 52 to 61%, while a hook took a comparable rule
# from 207 violations to 2. The Grounding line makes the agent say what it looked at before it edited.
# Loop prevention: when Claude Code sets `stop_hook_active` (the worker is already continuing because of a
# stop hook), the second stop passes. Fail open: unreadable input or a non-operator agent passes.
# Report source: `last_assistant_message`; if absent, the last assistant text in `agent_transcript_path`.
# Wiring: settings.json hooks.SubagentStop, matcher "operator".
# Test: bash tests/operator-done-gate.test.sh
INPUT=$(cat)
TYPE=$(printf '%s' "$INPUT" | jq -r '.agent_type // ""' 2>/dev/null) || exit 0
[ "$TYPE" = "operator" ] || exit 0
[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
REPORT=$(printf '%s' "$INPUT" | jq -r '.last_assistant_message // ""')
if [ -z "$REPORT" ]; then
  TP=$(printf '%s' "$INPUT" | jq -r '.agent_transcript_path // .transcript_path // ""')
  [ -n "$TP" ] && [ -f "$TP" ] && REPORT=$(jq -rs '[.[] | select(.type=="assistant") | .message.content
      | if type=="array" then (map(select(.type=="text") | .text) | join("\n")) else (. // "") end
      | select(length>0)] | last // ""' "$TP" 2>/dev/null)
fi
# Markdown decoration (>, *, _, `, -) before the label is tolerated
printf '%s\n' "$REPORT" | grep -Eq '^[[:space:]>*_`]*Status:[[:space:]*_`]*Done([^A-Za-z]|$)' || exit 0
printf '%s\n' "$REPORT" | grep -Eq '^[[:space:]>*_`-]*Grounding:' && exit 0
jq -n --arg r "operator-done-gate: the report says Status: Done but has no \`Grounding:\` line. Add it: the repo sweep (count and files), the dependency source read at the installed version (path:line, or \`none called\`), and the baseline command with its result before the change. Then send the report again. If you did not ground the change, report Partial and say so under Not done." \
  '{decision:"block",reason:$r}'
exit 0
