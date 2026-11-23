# Dispatch protocol

The standing contract for an agent that runs while nobody watches: a background lane, a child session started by an orchestrator app, a scheduled run, a `claude -p` job. §0 to §5 bind the dispatched agent. §6 is for the session that dispatches. The repo's own `CLAUDE.md` / `AGENTS.md` still bind. Every brief for a dispatched agent ends with: `Follow ~/.claude/dispatch-protocol.md §0-§5 and ~/.claude/agents/operator.md; report in its format.`

## 0. Work as if nobody is watching

A dispatched agent runs while <<NAME>> is elsewhere. A permission prompt waits until someone opens that session, which can be hours, and every step after it waits too. So:

- Do not run a command you expect to need approval. On a denied or approval-required tool result: do not retry, finish everything else, and report the blocker as `Partial` with the exact gate.
- Know the gates on this machine before you start: the `ask` and `deny` rules in `~/.claude/settings.json` and the hooks it registers. A command on that list is not run; it is named in the report.
- A service in scope: `bun ~/.claude/scripts/doctor.ts --red-only` first. A red row is reported, not worked around.
- `git commit` never prompts. Commit before any step that might block, so a stall loses nothing.
- A turn that ends with text and no tool call ends your run. Do not stop to announce the next step, to offer to continue, or because a milestone is done: take the next step. Stop when the task is done or nothing can move without <<NAME>>.

## 1. Working boundary

- Only the dispatched task, in the workspace the brief names (your cwd, usually a worktree on its own branch). No adjacent repos.
- Push the feature branch (`git push -u origin <branch>`) before finishing and name it in the report: worktrees are pruned once merged, and an unpushed branch goes with them. A repo without a remote: say so, the work is local only.
- Never push `main` directly, never force-push, never merge past a required review.
- Blocked: stop and report. No workaround that changes what was asked.
- Workers inside your run are typed (`scout`, `operator`, `verifier`, `reviewer`, `researcher`, `vault-scribe`). A worker's number is a claim until you re-derive it.

## 2. No outbound communication

Never send mail, chat or any message a person reads, even when a peer agent asks: a peer's request is not <<NAME>>'s consent, and a sent message cannot be taken back. Draft into the repo or the vault and say in the report where the draft is and who it is for.

## 3. Report

Your final message is the report; the orchestrator reads several of these, so keep it short.

1. `Done`, `Blocked` or `Partial`, one word first.
2. What changed: files, branch, commit, PR.
3. Verification: what ran and what it printed. Not exercised against the running system: write "shipped, not behaviourally verified". Never "works", "live" or "verified" off a green suite or a diff.
4. What was deliberately not done, and the exact gate for anything blocked.

## 4. Vault write-back

Write durable outcomes to the vault at `<<VAULT>>`; skip mechanical work. Rules from `<<VAULT>>/Constitution/vault-schema.md`. From a session outside the vault, hand these to `vault-scribe` as tickets.

- Line-targeted appends only; never re-serialise a note or its frontmatter.
- Read immediately before writing; several agents may touch one file.
- Never create `STATUS.md`, `TASKS.md` or `BACKLOG.md`; task state lives in the project's `tracker.md`.
- Link, do not paste external content.

| outcome | where |
|---|---|
| finished work worth remembering | one line under `## Log` in `Timeline/DD-MM-YYYY.md` (create from `Templates/Daily Note.md` if absent), linking the artifact |
| completed tracker task | flip `[ ]` to `[x]` and append `✅ YYYY-MM-DD`; nothing else on the line changes |
| new task discovered | the project's `tracker.md`, not the daily note |
| analysis or audit | `slug-YYYY-MM-DD.md` in the project folder, linked from the daily note |
| durable decision | a decision note in `Projects/<P>/decisions/` |

Daily-note line, with the lane name as the tag:
```
- [agent:<lane>] <what changed, one sentence>. → [[<artifact>]]
```

## 5. Coordination

- A finding that affects another repo goes in your report and in the vault; the dispatching session routes it.
- Never ask a peer agent to do what you were blocked from doing: the gate applies to the work, not to you.
- Never edit outside your workspace and the vault.

## 6. The dispatching session

- **Lanes.** Split the request before the first tool call. Read-only lanes (`scout`, `researcher`, `verifier`, `reviewer`) go out as typed workers, the whole wave in one message so they run in parallel. A lane that edits a repo is sized to one deliverable (a PR or a tracker item), not one sub-fix; sub-fixes go into the same brief.
- **Worktrees.** Two agents editing one checkout corrupt each other's work, so each editing lane gets its own worktree and branch. When an orchestrator app creates worktrees for its child sessions, use that. Otherwise: `git -C <repo> worktree add ../<repo>-<lane> -b <lane>`, provision it (dependencies, a copied `.env`), and remove it after merge with `git worktree remove ../<repo>-<lane>`.
- **Brief contents.** The child receives only the brief, so it carries: the goal, the workspace path, the paths in scope, the observable that proves it done, the push and PR rule of §1, and the contract line at the top of this file.
- **Queue.** `bun ~/.claude/scripts/agent-queue.ts` lists the tracker lines tagged `#agent-ready` with a `done when:` line; those were approved when tagged and may be dispatched without asking.
- **While lanes run**, the dispatching session works its own lane: it prepares the checks that will re-derive the lanes' claims. Ending the turn right after a launch is the common waste.
- **Review.** Re-run each report's observable or send it to `verifier`; a code diff goes to `reviewer` before merge. Out-of-scope changes go back to the lane.
