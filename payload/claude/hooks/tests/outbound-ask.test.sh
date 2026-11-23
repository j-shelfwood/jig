#!/bin/bash
# Cases for outbound-ask.sh. Usage: bash tests/outbound-ask.test.sh [hook-path]
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_lib.sh"
HOOK="${1:-$DIR/../outbound-ask.sh}"
p() { jq -cn --arg t "$1" --argjson i "$2" '{tool_name:$t,tool_input:$i}'; }
check ask mail-send "$(p mcp__mail__send_email '{"to":["a@example.com","b@example.com"],"body":"hi"}')"
OUT=$(p mcp__mail__send_email '{"to":["a@example.com","b@example.com"],"body":"hi"}' | "$HOOK")
has names-recipients "$OUT" "to=a@example.com, b@example.com"
check ask chat-post "$(p mcp__chat__create_post '{"channel_id":"town-square","message":"hi"}')"
OUT=$(p mcp__chat__create_post '{"channel_id":"town-square","message":"hi"}' | "$HOOK"); has names-channel "$OUT" "channel_id=town-square"
check ask reply "$(p mcp__mail__reply_all '{"thread_id":"t1","body":"x"}')"
check ask dm "$(p mcp__chat__dm '{"username":"someone","message":"x"}')"
check ask no-recipient-field "$(p mcp__x__send_message '{"body":"x"}')"
OUT=$(p mcp__x__send_message '{"body":"x"}' | "$HOOK"); has says-unknown "$OUT" "recipient not in tool_input"
check empty read-tool "$(p mcp__chat__read_channel '{"channel_id":"x"}')"
check empty draft-tool "$(p mcp__mail__create_draft '{"to":"a@example.com"}')"
check empty non-mcp-tool "$(p Bash '{"command":"echo send_message"}')"
check empty not-json 'not json'
finish
