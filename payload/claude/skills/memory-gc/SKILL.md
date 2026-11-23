---
name: memory-gc
description: Garbage-collect one Claude Code auto-memory store. Classifies every file (keep / compress / merge / delete), verifies each fact against its source before acting, rewrites MEMORY.md to match the surviving files, and reports before and after with deletions listed for sign-off. Use when a store feels bloated, after a project ends, or on "/memory-gc <store>", "clean up memory", "debloat memory", "memory audit".
---

# memory-gc: one store per run

Auto-memory lives in `~/.claude/projects/<slug>/memory/`, one store per working directory. Every line of `MEMORY.md` loads into each session started there, so a stale or duplicated memory costs tokens every session and, worse, is read as current fact. Run against one store per invocation: the argument is a store hint resolved against `~/.claude/projects/*/memory`. No argument: list stores by word count, largest first, and ask which one.

## Hard rules

1. **The stores are not in git** and have no history. Never overwrite or delete a file before its content is preserved: compress by first copying to `<name>-full-YYYY-MM-DD.archive.md` (description prefixed `ARCHIVE (not for recall)`), then rewriting the live file.
2. **`rg` skips these directories** when they are ignored by a `.gitignore` above them (it prints "No files were searched"). Use `grep -r`, or `rg --no-ignore`.
3. Store directory names start with a dash (`-Users-...`), which breaks bare `mv` and `rm`: always use absolute paths or prefix with `./`.
4. Deletions are proposed and executed only after <<NAME>> signs off **in this session**, because there is no undo. Compression and register rewrites proceed without asking: the archive copy is the undo.
5. A fact is edited, compressed or deleted only after checking it against its source of truth (the repo, `git log`, a vault note, the live system). A fact that cannot be checked is kept verbatim and flagged, never dropped silently.

## Protocol

1. **Inventory**: word count, file count, last-modified per file. Read every file; they are small.
2. **Classify each file**:
   - `keep`: current, one fact, indexed in MEMORY.md.
   - `compress`: a saga that grew by accretion. Archive it, then rewrite the live file to root cause, standing rule and open items (about 200 to 300 words). Keep the line that says why the memory exists.
   - `merge`: fragments of one fact across files; fold into the canonical file, delete the rest after sign-off.
   - `delete`: restates a skill, capability, repo doc or `CLAUDE.md`; describes a finished one-off with no reusable lesson; or is superseded. One-line justification each.
3. **Register**: narration goes into one language (English unless your `CLAUDE.md` names another for memory); quoted speech, UI strings and code stay verbatim because they are evidence. Strip em dashes (U+2014), first person and conversational framing: a memory is read back at the top of a future context, so its voice becomes that session's voice. Count `grep -c $'\u2014' <store>/*.md` (zsh) before and after.
4. **Dates**: relative dates ("tomorrow", "next week") become absolute.
5. **Reindex**: rewrite `MEMORY.md` to match the surviving files exactly, one line per memory with a short hook; archive files are not indexed.
6. **Report**: words before and after, a classification table (file, class, the source checked, result), the deletions awaiting sign-off, and a residual check proving no orphaned index line: `grep -o '([^)]*\.md)' MEMORY.md` against `ls`.

## Notes

- Scoring files by markers (FIXED, DONE) finds candidates but flags living reference files whose content is resolved root causes kept for reuse. Rule 5 catches these: never compress on a score alone.
- A store for infrastructure that is rarely touched is not dead: check whether skills or scripts still reference it before proposing deletion.
- When a fact's home is another store or a doc, replace the local copy with a one-line pointer instead of keeping a second copy that will drift.
