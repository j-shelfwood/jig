# Claude Code: global configuration

@<<VAULT>>/<<AGENT_DIR>>/working-principles.md
@<<VAULT>>/<<AGENT_DIR>>/machine-context.md
@<<VAULT>>/<<AGENT_DIR>>/about-me.md

## Layers

| layer | file | loads |
|---|---|---|
| always-on | this file + the three imports above (they live in the Obsidian vault) | every session |
| register | `output-styles/operational-spec.md` | `settings.json` `outputStyle`; governs replies only |
| skills | `skills/<name>/SKILL.md` | by the trigger words in each `description` |
| capabilities | `capabilities/<service>.md` | when a service is touched |
| workers | `agents/<name>.md` | when spawned through the Agent tool |
| gates | `settings.json` `permissions` and `hooks` | harness-enforced; prose never substitutes for them |

## Routing (one line per rule; the owner file holds the detail)

- Any external service (GitHub, chat, mail, hosting): `capabilities/<service>.md` first. No file yet: write one from `capabilities/_TEMPLATE.md` once access works.
- Any API key, token or password: read it from where the capability file says (env var name or password-manager reference). Never print a secret, never write one to a file in git or the vault.
- Code, comments, commit messages: <<CODE_LANGUAGE>>. Replies to <<NAME>>: <<REPLY_LANGUAGE>>.
- Project state (tasks, decisions, hand-off, people): the vault at `<<VAULT>>`. Read `<<VAULT>>/Constitution/vault-schema.md` before writing typed notes. From a session outside the vault, vault writes go to the `vault-scribe` worker.
- Start of a session in a project: skill `start` (handoff, tracker, git, open PRs, then lanes).
- Spawning a worker: a typed one (`scout`, `operator`, `verifier`, `vault-scribe`); untyped spawns are denied by a hook.
- A decision for <<NAME>>: the AskUserQuestion tool, recommended option first.
- An access problem fixed by hand: record it in `capabilities/<service>.md` under `## Known failures`, nowhere else.

## Memory

Two state stores, one owner each. Auto-memory holds facts about how to work (tool quirks, access paths, preferences). The vault holds project state (people, dates, waiting-on, decisions, tasks, the hand-off). Messages and mail are read live from their channel and never copied into either. A memory that restates a skill, a capability or a repo doc is a duplicate: replace it with a pointer. Memories are written as facts: no narration, no first person, no em dashes.

## Compact Instructions

A compaction summary is written as sections `[STATE]` (task, done, open, invariants) and `[LEDGER]` (changed, verified, unverified, skipped): facts, files, observations; no first person. Keep every standing instruction <<NAME>> gave in the session (confirmation gates, scope limits, "do not" rules) as one list, verbatim.
