# Vault: agent rules

Vault root: `<<VAULT>>`. Loaded when a session's working directory is the vault.

- `Constitution/vault-schema.md` is the contract for note types, frontmatter, task grammar and write rules. Read it before creating or changing any typed note.
- `Constitution/documentation-temperaments.md` decides what kind of document something is before it is written.
- A session writes into the vault only what outlives the session: a fact, a decision, a call note, a project or person note, a task. Plans, sweeps and drafts made while working stay in chat or in the repo they concern; the decisions in them go to `decisions/`, the open work to `tracker.md`.
- Before creating a new file, name the existing note it will be linked from. A note nobody can find again is not created.
- Decisions: captured in the daily `## Log`, promoted to a note in the project's `decisions/`.
- Commit your own edits by path in the turn you make them. Never `git add -A`.
- The prompt files in `<<AGENT_DIR>>/` are imported into every Claude Code session. Edit them deliberately: a change there changes every agent.
