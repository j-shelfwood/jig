#!/bin/bash
# Cases for no-general-purpose-agent.sh. Usage: bash tests/no-general-purpose-agent.test.sh [hook-path]
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_lib.sh"
HOOK="${1:-$DIR/../no-general-purpose-agent.sh}"
a() { jq -cn --argjson i "$1" '{tool_name:"Agent",tool_input:$i}'; }
check deny general-purpose "$(a '{"subagent_type":"general-purpose","prompt":"x"}')"
check deny untyped "$(a '{"prompt":"x"}')"
check empty scout "$(a '{"subagent_type":"scout","prompt":"x"}')"
check empty operator "$(a '{"subagent_type":"operator","prompt":"x"}')"
check empty not-json 'not json'
OUT=$(a '{"prompt":"x"}' | "$HOOK"); has names-types "$OUT" "operator"
finish
