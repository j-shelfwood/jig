#!/bin/bash
# Cases for vault-write-gate.sh. Usage: bash tests/vault-write-gate.test.sh [hook-path]
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_lib.sh"
HOOK="${1:-$DIR/../vault-write-gate.sh}"
V="$HOME/Obsidian/TestVault"
export VAULT_ROOT="$V"
w() { jq -cn --arg c "$1" --arg f "$2" --arg a "${3:-}" '{tool_name:"Write",cwd:$c,tool_input:{file_path:$f}} + (if $a != "" then {agent_type:$a} else {} end)'; }
check context outside-session-warns "$(w /tmp/repo "$V/Projects/X/tracker.md")"
VAULT_WRITE_GATE_MODE=deny check deny outside-session-deny-mode "$(w /tmp/repo "$V/Projects/X/tracker.md")"
check empty inside-vault-session "$(w "$V" "$V/Projects/X/tracker.md")"
check empty inside-vault-subdir-session "$(w "$V/Projects" "$V/Projects/X/tracker.md")"
check empty vault-scribe "$(w /tmp/repo "$V/Projects/X/tracker.md" vault-scribe)"
check empty non-vault-target "$(w /tmp/repo /tmp/repo/README.md)"
check empty sibling-prefix "$(w /tmp/repo "${V}Other/x.md")"
VAULT_ROOT="~/Obsidian/TestVault/" check context tilde-and-slash-root "$(w /tmp/repo "$V/x.md")"
check empty not-json 'not json'
finish
