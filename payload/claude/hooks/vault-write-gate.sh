#!/bin/bash
# vault-write-gate.sh: a vault write from a session outside the vault goes through the vault-scribe worker.
#
# Why: the vault grammar (task emoji format, decision notes, write rules) lives in the vault's CLAUDE.md
# and vault-schema.md. A session working in a code repo does not carry it and hand-builds broken task
# lines. It sends vault-scribe a ticket instead.
# Exempt: a session whose cwd is inside the vault, and vault-scribe itself (payload field agent_type).
# Mode: VAULT_WRITE_GATE_MODE=warn (default, adds context, the call proceeds) or deny.
# Wiring: settings.json hooks.PreToolUse, matcher "Edit|Write|MultiEdit".
# Test: echo '{"tool_name":"Write","cwd":"/tmp","tool_input":{"file_path":"'"$HOME"'/Obsidian/Vault/x.md"}}' | ./vault-write-gate.sh
INPUT=$(cat)
VAULT="${VAULT_ROOT:-<<VAULT>>}"
MODE="${VAULT_WRITE_GATE_MODE:-warn}"
TARGET=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0
CWD=$(echo "$INPUT" | jq -r '.cwd // ""')
AGENT=$(echo "$INPUT" | jq -r '.agent_type // ""')

case "$TARGET" in "$VAULT"/*) ;; *) exit 0 ;; esac
case "$CWD" in "$VAULT"|"$VAULT"/*) exit 0 ;; esac
[ "$AGENT" = "vault-scribe" ] && exit 0

MSG="Vault write from a session outside the vault (cwd ${CWD:-unknown}). Send the vault-scribe worker a ticket (kind, project, final text, source ref) instead (hooks/vault-write-gate.sh, mode $MODE)."
if [ "$MODE" = "deny" ]; then
  jq -n --arg r "$MSG" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
else
  jq -n --arg m "$MSG" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$m}}'
fi
exit 0
