---
type: schema
status: current
---

# Documentation temperaments

The law: **documentation that requires discipline rots; documentation that carries its decay mechanism in its structure survives.** In a survey of about 1,000 notes and 15 repos, every unowned status or task prose file was stale, while dated artifacts, append-only ledgers and one-fact notes stayed trustworthy even unowned.

Every document declares one temperament when it is created:

| temperament | form | decay mechanism | examples |
|---|---|---|---|
| fact | one falsifiable statement per file, one-line index | falsifiable, so checkable | auto-memory files |
| event | dated artifact, date in the filename | age is visible | analyses, call notes, audits, plans |
| ledger | append-only, one line per entry with a source; retired by a new entry with `supersedes:` | provenance | decision notes, daily `## Log`, tracker lines |
| assembly | an index that only points (`@` imports, tables of links) | content lives once, elsewhere | `CLAUDE.md`, `MEMORY.md` |
| snapshot | replaced in place, bounded sections, freshness checked | a linter flags it stale | `handoff.md`, the only safe mutable note |
| view | computed, never hand-written | as fresh as its inputs | Bases views, dashboards |

Rules:

1. No `TASKS.md`, `STATUS.md`, `BACKLOG.md`: status is a view or a checked snapshot, work items are tasks in the vault grammar.
2. `CLAUDE.md` is an assembly under 5 KB: content lives in canonical files, `CLAUDE.md` points.
3. One supersession dialect: `supersedes:` on the new entry. No `-old` filenames, no strikethrough edits.
4. Negative decisions (deliberately not done) are ledger entries too: they stop the same idea from being proposed again.
