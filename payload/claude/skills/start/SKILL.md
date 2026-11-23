---
name: start
description: Session driver for one project. Reads what the last session left and what came in (handoff, tracker, git, open PRs and CI, the #agent-ready queue), propose how the open items split into parallel lanes for typed workers, run the approved lanes, and review each result until it meets the bar (tests ran, diff in scope, claims re-derived). Use at the first turn of a project session and for "start", "where were we", "pick up where I left off", "what's open here", "work the queue", "next item", "fan out".
---

# Start: discover, propose, orchestrate, review

## 1. Discover (read-only, one message)

Resolve the project from the working directory: the repo, and its vault folder `<<VAULT>>/Projects/<Project>/`.

| lane | worker | reads |
|---|---|---|
| state | inline | `handoff.md` (State, Next, Open questions), open lines in `tracker.md` |
| git | `scout` | `git status -sb`, `git log --since="14 days ago" --oneline`, branches ahead of main, `gh pr list` with check state, `gh run list --limit 5` |
| queue | inline | tracker lines tagged `#agent-ready` that carry `done when:`, not blocked, not scheduled in the future |

While the scout runs, read the repo's `CLAUDE.md` and size the territory of each open item by counting before reading.

## 2. Propose

One table, one row per lane: item, worker (`operator` for edits, `scout` for discovery), paths in scope, the observable that proves it done, and whether any step needs approval. Then one AskUserQuestion: run all rows (Recommended), none, or the user types row numbers.

`#agent-ready` items were approved when they were tagged: they run without the question, to their `done when:` line.

## 3. Orchestrate

- Independent lanes go out in one message, one worker each. Each brief carries: the goal, the workspace path, the paths in scope, the observable, and "report in your agent file's format".
- Two lanes that edit the same repo need separate worktrees or must run one after the other.
- Meanwhile, prepare the checks that will re-derive the workers' claims.

## 4. Review

For each report:

- Re-run the observable yourself, or send the claim to `verifier`.
- Check the diff is in scope (`git diff --stat`); out-of-scope changes go back.
- Missing test or probe: send the lane back once with that one gap named.

Then write back through the vault rules: flip finished tracker lines, add new tasks found, rewrite the handoff sections that changed, one `## Log` line per decision.
