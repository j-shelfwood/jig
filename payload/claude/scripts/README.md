# scripts

Four read-only tools on bun (builtins only, no dependencies). Install: copy this folder to `~/.claude/scripts/`, then copy `config.example.json` to `config.json` and fill `<<VAULT>>` and `<<PROJECTS>>` (or export `VAULT_ROOT`). Tests: `bun test ~/.claude/scripts`, synthetic fixtures only.

| tool | command | what it answers |
|---|---|---|
| agent-queue | `bun ~/.claude/scripts/agent-queue.ts [--json] [--repo <name>]` | Which `#agent-ready` tasks with a `done when:` can an agent take now, in priority and due order, and how many ready-tagged lines lack the observable? |
| vault-lint | `bun ~/.claude/scripts/vault-lint.ts [--summary] [--json]` | Where has the vault drifted from `Constitution/vault-schema.md`: stale or long handoffs, stray tasks, undated artifacts, broken decision chains, forbidden STATUS/TASKS/BACKLOG files, uncommitted changes? |
| doctor | `bun ~/.claude/scripts/doctor.ts [--red-only] [--json] [--fresh]` | Which services in `~/.claude/capabilities/` pass their `health` line right now? `--red-only` feeds `hooks/session-start-doctor.sh`. |
| trace | `bun ~/.claude/scripts/trace.ts sessions [--since 7d]` / `clusters [--since 30d] [--min 3]` | Per session: tool calls, errors, hook denials, interrupts, rejected tool uses; across sessions: which error signatures recur (the input for a weekly retro)? |
