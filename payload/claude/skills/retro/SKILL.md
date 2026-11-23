---
name: retro
description: Weekly retro over your own Claude Code transcripts. Finds friction that recurs across sessions (repeated tool errors, hook blocks, denials, interrupts, commands the user had to run by hand, auth or paste steps handed to the user), groups it into clusters, and turns each cluster into a proposed fix with a destination (hook, capability Known failures, skill or prompt edit, memory). Reports first; reversible edits follow in the same turn with their undo commands. Use for "retro", "weekly retro", "what keeps going wrong", "recurring errors", "session patterns", "mine my sessions", "why does X keep failing". Not for the health of a deployed service.
---

# Retro: from recurring friction to a fix with an owner

A failure seen once is an incident. The same signature in five sessions is a defect in the setup: a missing doc, a doc that is not loaded when it is needed, a wrapper that should exist, a hook message that does not say what to do. This skill finds the second kind. Run it once a week.

## Instruments

```bash
bun ~/.claude/scripts/trace.ts sessions --since 7d            # sessions of the week: project, prompts, tool calls, errors
bun ~/.claude/scripts/trace.ts clusters --since 30d --min 3   # recurring error signatures across sessions
bun ~/.claude/scripts/vault-lint.ts                           # vault drift: stale handoffs, uncommitted notes
bun ~/.claude/scripts/doctor.ts --red-only                    # capabilities whose health check is red now
```

`clusters` groups errors by signature (the error text with digits and paths normalised), not by command, because the same failure arrives through different commands. `--min 3` keeps signatures seen in at least three sessions.

## Signatures file

Claude Code deletes transcripts after `cleanupPeriodDays` (30 by default). A retro that only reads transcripts loses everything older than a month, including the evidence that a fix worked. So after each run, append every cluster to `~/.claude/retro/signatures.jsonl`, one JSON line each:

```
{"week":"YYYY-Www","signature":"...","sessions":n,"calls":n,"verdict":"...","fix":"<file or none>"}
```

Rows hold the normalised signature and counts, never prompt text or tool output, because the file outlives the transcripts it summarises and may be read in another context. Keep `~/.claude/retro/` out of git. Before proposing a fix, `rg '<signature fragment>' ~/.claude/retro/signatures.jsonl`: a signature that already has a fix and still recurs means the fix did not work.

## Procedure

0. **Delete before adding.** A setup that only grows stops loading. List the hooks, skills and rule lines older than 30 days (`git -C ~/.claude log --diff-filter=A`, `git blame`) that no cluster in this or the last four retros cites. Each is a delete candidate. The retro adds at most as many hooks, skills and rule lines as it deletes.
1. Run `trace.ts sessions --since 7d` and `trace.ts clusters --since 30d --min 3`. Read the footer: the window and how many transcripts were read.
2. Take each cluster seen in 3 or more sessions, or retried by the agent, or recurring after a fix in `signatures.jsonl`.
3. Read up to three samples per cluster, from different sessions. Many signatures are the agent's own exploration (an `ls` of a path that does not exist, a probing script), not setup friction.
4. Before writing "undocumented", run a second instrument: `rg --no-ignore` for the fix's keywords over `~/.claude/capabilities`, `~/.claude/skills` and the memory stores. Plain `rg` skips what `.gitignore` hides, which under `~/.claude` is most things.
5. One verdict and one destination per cluster:

| verdict | destination |
|---|---|
| benign: exploration, or a nonzero exit that carries information (`grep` exit 1) | none; recorded in `signatures.jsonl` so the next retro skips it |
| undocumented access problem | a row in `## Known failures` of `capabilities/<service>.md`, the only place an access fix lives |
| documented, still hit | routing failed and more prose will not fix it: a hook, a wrapper script or alias that makes the right call the default, or a trigger phrase in the skill's `description` |
| prompt rule ignored | an edit to the skill, agent or output style that owns it; run skill `prompt-audit` first for a large rewrite |
| fact about how to work (a tool quirk, a path) | a memory file, one fact, with a pointer if a doc already owns it |

6. Report first: one table, cluster, sessions/calls, samples read, verdict, proposed change, destination. Then apply the reversible edits (git-tracked files under `~/.claude`) in the same turn and list each with its undo command (`git -C ~/.claude revert <hash>`). A change that leaves the machine, or deletes data, waits for <<NAME>>.
7. Append the clusters to `signatures.jsonl`.

## Constraints

- Transcript content (prompts, tool output, client material) stays in the session: not in memory files, the vault, `signatures.jsonl` or a draft.
- A number in the report comes from a command run in this retro. Hand-written counts over raw transcripts double-count: newer transcripts repeat tool calls inside request records, and `trace.ts` already skips them.
- No `claude -p` from a script. The model stage is this session reading the report.
- Blind spots: work done in a terminal outside Claude never reaches a transcript, and anything past the retention window exists only as rows in `signatures.jsonl`.
- A credential seen in a sample is stated once; rotation is not a retro finding.
