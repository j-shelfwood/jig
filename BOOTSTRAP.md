# BOOTSTRAP: instructions for the setup agent

You are setting up a Claude Code working environment for your user, modelled on the blueprint in this folder. Read `docs/architecture.md` and `docs/prompting-strategies.md` before you start; they explain why each file exists, and you will need that to adapt it rather than copy it.

```mermaid
flowchart TD
    P0["0 inventory<br/>read only"] --> P1["1 interview<br/>AskUserQuestion"]
    P1 --> PL{"plan table:<br/>user says yes?"}
    PL -- "no" --> P1
    PL -- "yes" --> BK["back up ~/.claude<br/>and the vault folder"]
    BK --> P2["2 folders<br/>Projects, vault, git init"]
    P2 --> P3["3 ~/.claude stage 1<br/>CLAUDE.md, style, agents"]
    P3 --> S2{"stage 2<br/>chosen?"}
    S2 -- "yes" --> P4["4 hooks, capabilities,<br/>start skill"]
    S2 -- "no" --> P5
    P4 --> P5["5 verify: placeholders,<br/>@ paths, /memory, hook fixtures"]
    P5 --> RP["report + commit"]
```

## Ground rules

- Never overwrite an existing file without a backup. Before phase 3, copy any existing `~/.claude/` to `~/.claude.bak-<YYYY-MM-DD>/`, and do the same for a vault folder you would write into.
- Every `<<PLACEHOLDER>>` in `payload/` is filled from the interview; machine facts (`<<OS>>`, `<<SHELL>>`, `<<RUNTIMES>>` and the like) come from the phase 0 inventory, and any placeholder that neither covers is one more interview question. Never leave one in an installed file; `rg '<<[A-Z_]+>>' ~/.claude <vault>` must return nothing at the end.
- Text in `payload/` that names Joris, his clients, his servers or his tools is an example of the pattern. Replace it with your user's equivalent or delete it. Do not install another person's rules verbatim.
- Show the plan (a table: path, action, source) and get a yes before phase 3. After that, reversible local work needs no further confirmation.
- Use the package managers already on the machine. Ask before installing anything system-wide.

## Phase 0: inventory (read only)

Report in one table:

- OS, shell, and which of `git`, `rg`, `jq`, `bun`/`node`, `uv`/`python3`, `gh`, `obsidian` are installed.
- Does `~/.claude/` exist? List `CLAUDE.md`, `settings.json`, `agents/`, `skills/`, `output-styles/`, `hooks/` and their sizes.
- Existing Obsidian vaults (look for folders containing `.obsidian/`, for example under `~/Documents`, `~/Obsidian`, iCloud).
- Does `~/Projects/` (or another code folder) exist, and how many git repos are in it (`find ~/Projects -maxdepth 2 -name .git | wc -l`)?

## Phase 1: interview

Ask with the AskUserQuestion tool, at most 4 questions per call, a recommended option first. Collect:

| placeholder | question |
|---|---|
| `<<NAME>>` | What should agents call you? |
| `<<ROLE>>` | What do you do (one line), and what do you mostly build? |
| `<<STACK>>` | Main languages, frameworks, package managers, in order of preference |
| `<<REPLY_LANGUAGE>>` | Language for replies; language for code and commit messages |
| `<<VAULT>>` | Absolute path of the vault: an existing one, or a new one (recommend `~/Obsidian/<Name>`: **no spaces** in the path, so `@` imports resolve cleanly) |
| `<<AGENT_DIR>>` | Folder in the vault that holds the prompt files (recommend `Agent`, no spaces) |
| `<<PROJECTS>>` | Code folder (recommend `~/Projects`, one checkout per repo, flat) |
| `<<APPROVALS>>` | Which actions must always be asked first? Offer: messages to people, spend, deleting data, production deploys, pushes to main. Everything reversible is done without asking. |
| `<<STAGES>>` | Install stage 1 only (recommended), 1+2, or read about 3 as well |
| `<<SERVICES>>` | Which services agents will touch (GitHub, a chat tool, mail, a cloud host, a tracker). Each becomes a capability file in stage 2. |

## Phase 2: folders

1. `<<PROJECTS>>/` exists, flat: `<<PROJECTS>>/<repo>`. No nesting by client; the repo name carries it.
2. Vault: create or extend with this layout (skip folders the user already has under another name and map them instead):

```
<<VAULT>>/
  <<AGENT_DIR>>/        prompt files @-imported by ~/.claude/CLAUDE.md (from payload/vault/Agent)
  Constitution/         vault-schema.md, documentation-temperaments.md (from payload/vault/Constitution)
  Projects/<Name>/      entry note, tracker.md, handoff.md, decisions.md, decisions/
  Network/              one note per person or organisation
  Resources/            reference material, untyped
  Timeline/             one daily note per day, DD-MM-YYYY.md
  Templates/            (from payload/vault/Templates)
  CLAUDE.md             vault-local rules (from payload/vault/CLAUDE.md)
```

3. `git init` the vault if it is not a repo, with a `.gitignore` holding `.obsidian/workspace*.json` and `.trash/`. Git is the audit log of every agent write.
4. Obsidian plugins to enable (ask first): **Tasks** (the task grammar), **Templater** (the templates), Bases is built in. Optional: Calendar.

## Phase 3: ~/.claude (stage 1)

| source | destination | adapt |
|---|---|---|
| `payload/vault/Agent/*.md` | `<<VAULT>>/<<AGENT_DIR>>/` | fill placeholders; `machine-context.md` from the phase 0 inventory |
| `payload/claude/CLAUDE.md` | `~/.claude/CLAUDE.md` | the `@` lines point at `<<VAULT>>/<<AGENT_DIR>>/`; merge with an existing file, keep its user rules |
| `payload/claude/output-styles/operational-spec.md` | `~/.claude/output-styles/` | name and language |
| `payload/claude/agents/*.md` | `~/.claude/agents/` | models: keep the role split (cheap model for read-only search, strongest for execution and verification) |
| `payload/claude/settings.json` | merge into `~/.claude/settings.json` | never replace an existing file; merge keys with `jq` |

Then `git init ~/.claude` with a `.gitignore` that excludes everything except `CLAUDE.md`, `settings.json`, `agents/`, `skills/`, `output-styles/`, `hooks/`, `capabilities/`, `system-instructions/` (Claude Code writes caches, transcripts and history there too; those stay out of git).

## Phase 4: stage 2 (only if chosen)

- `payload/claude/hooks/*.sh` → `~/.claude/hooks/`, `chmod +x`, and wire them in `settings.json` as shown in `payload/claude/settings.json`. Set `VAULT_ROOT` in the hook to `<<VAULT>>`.
- `payload/claude/capabilities/` → `~/.claude/capabilities/`: one file per service from `<<SERVICES>>`, filled from `_TEMPLATE.md`, each with a `health` line you actually ran.
- `payload/claude/skills/start/` → `~/.claude/skills/start/`.

## Phase 5: verify (each check could fail; report its output)

1. `rg '<<[A-Z_]+>>' ~/.claude <<VAULT>>` → no hits.
2. Every `@` path in `~/.claude/CLAUDE.md` exists: `rg -o '^@(\S+)' -r '$1' ~/.claude/CLAUDE.md | sed "s|^~|$HOME|" | xargs -I{} test -f {} && echo ok`.
3. Ask the user to start a fresh `claude` session in `<<PROJECTS>>` and run `/memory`: the imported vault files must be listed. Then ask it "which agent types can you spawn?": the typed workers must be named.
4. Hooks (stage 2): pipe a fixture into each one and show the decision, for example
   `echo '{"tool_name":"Agent","tool_input":{"subagent_type":"general-purpose"}}' | ~/.claude/hooks/no-general-purpose-agent.sh` → a `deny` JSON.
5. `git -C ~/.claude status` and `git -C <<VAULT>> status`: commit the setup by path, one commit each.

## Report

End with: what was installed (paths), what was skipped and why, the verification output, and the three things the user should do in the first week (see `docs/architecture.md`, "First week").
