#!/bin/bash
# Cases for operator-done-gate.sh. Usage: bash tests/operator-done-gate.test.sh [hook-path]
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_lib.sh"
HOOK="${1:-$DIR/../operator-done-gate.sh}"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
DONE_G=$'Status: Done\nChanged: src/x.ts (behavior-change)\nGrounding: rg -c x 4 files; none called; baseline `bun test` 1 failed\nObserved: `3 pass`'
DONE_NOG=$'Status: Done\nChanged: src/x.ts (behavior-change)\nObserved: `3 pass`'
DONE_MD=$'**Status:** Done\n- **Grounding:** rg -c x 2 files'
PARTIAL=$'Status: Partial\nChanged: src/x.ts\nNot done: tests because db down'
DONEISH=$'Status: Doneish\nChanged: src/x.ts'
p() { # agent_type report [stop_hook_active] [transcript]
  jq -cn --arg t "$1" --arg m "$2" --argjson s "${3:-false}" --arg tp "${4:-}" \
    '{hook_event_name:"SubagentStop",agent_type:$t,agent_id:"a1",stop_hook_active:$s}
     + (if $m != "" then {last_assistant_message:$m} else {} end)
     + (if $tp != "" then {agent_transcript_path:$tp} else {} end)'
}
check empty done-with-grounding "$(p operator "$DONE_G")"
check block done-without-grounding "$(p operator "$DONE_NOG")"
check empty second-stop-passes "$(p operator "$DONE_NOG" true)"
check empty partial-is-not-done "$(p operator "$PARTIAL")"
check empty doneish-is-not-done "$(p operator "$DONEISH")"
check empty markdown-decorated-grounding "$(p operator "$DONE_MD")"
check empty other-agent-type "$(p verifier "$DONE_NOG")"
check empty no-report "$(p operator "")"
check empty not-json 'not json'
# no last_assistant_message: the last assistant text in the transcript is the report
jq -cn --arg m "$DONE_G" '{type:"assistant",message:{content:[{type:"text",text:$m}]}}' > "$T/old.jsonl"
jq -cn --arg m "$DONE_NOG" '{type:"assistant",message:{content:[{type:"text",text:$m}]}}' >> "$T/old.jsonl"
jq -cn '{type:"user",message:{content:"ok"}}' >> "$T/old.jsonl"
check block transcript-fallback-last-report "$(p operator "" false "$T/old.jsonl")"
check empty missing-transcript "$(p operator "" false "$T/nope.jsonl")"
OUT=$(p operator "$DONE_NOG" | "$HOOK"); has reason-names-line "$OUT" "Grounding:"; has reason-way-out "$OUT" "Partial"
finish
