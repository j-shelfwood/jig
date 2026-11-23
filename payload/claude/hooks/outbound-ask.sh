#!/bin/bash
# outbound-ask.sh: a tool call that sends a message to a person asks first, and the prompt names the
# recipient, so the approval is about who receives it and not only about the tool.
#
# Why: in the setup this was derived from, 45 of 111 message sends were rejected at the prompt over 30 days,
# against 2 of 119 pushes and 5 of 146 PR calls: messages are where the agent is most often wrong, and a
# sent message cannot be taken back. The original gate also checks the text (length, questions, dashes,
# commitments); this generic version only asks.
# SEND_TOOLS: regex over tool_name, kept in sync with the settings.json matcher (the script re-checks it, so
# a broad matcher is safe). RECIPIENT_FIELDS: tool_input keys tried in order for the recipient.
# Wiring: settings.json hooks.PreToolUse, matcher = SEND_TOOLS.
# Test: bash tests/outbound-ask.test.sh
SEND_TOOLS='^mcp__.*__(send_.*|reply.*|create_post|dm|create_message|post_message)$'
RECIPIENT_FIELDS='to recipient recipients channel channel_id chat_id thread_id user_id username email'
INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null) || exit 0
printf '%s' "$TOOL" | grep -Eq "$SEND_TOOLS" || exit 0
WHO=""
for f in $RECIPIENT_FIELDS; do
  WHO=$(printf '%s' "$INPUT" | jq -r --arg f "$f" '.tool_input[$f] // empty
    | if type=="array" then map(tostring) | join(", ") else tostring end' 2>/dev/null)
  [ -n "$WHO" ] && { WHO="$f=$WHO"; break; }
done
[ -z "$WHO" ] && WHO="recipient not in tool_input (fields tried: $RECIPIENT_FIELDS)"
jq -n --arg r "outbound-ask: $TOOL sends a message to a person ($WHO). Check the recipient and the exact text before approving." \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
exit 0
