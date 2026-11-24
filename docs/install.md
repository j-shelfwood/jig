---
title: Install
description: "How the setup reaches your machine, through your own Claude Code agent."
---

You don't install this by hand. Your own Claude Code agent reads `BOOTSTRAP.md`, interviews you and builds the setup.

```sh
git clone https://github.com/j-shelfwood/agent-setup-blueprint.git ~/Projects/agent-setup-blueprint
cd ~/Projects/agent-setup-blueprint
claude
```

Then type:

> Read BOOTSTRAP.md and set up my machine following it. Interview me first.

```mermaid
flowchart TD
    P0["inventory<br/>read only"] --> P1["interview"]
    P1 --> PL{"plan table:<br/>you say yes?"}
    PL -- "no" --> P1
    PL -- "yes" --> BK["backup of ~/.claude<br/>and the vault folder"]
    BK --> P3["stage 1: CLAUDE.md,<br/>style, agents, Bases"]
    P3 --> S2{"stage 2?"}
    S2 -- "yes" --> P4["hooks, scripts,<br/>capabilities, skills"]
    S2 -- "no" --> P5
    P4 --> P5["checks that could fail,<br/>with their output"]
```

> [!info] What it asks you
> Your name and role, your stack, reply and code languages, where your vault and code live, which actions must always be asked first, which stages to install, and which services agents will touch. Machine facts come from the inventory.

> [!warning] Don't clone into an Obsidian vault
> The templates in `payload/vault/` would show up as real notes in your vault.

The full procedure: [BOOTSTRAP.md](https://github.com/j-shelfwood/agent-setup-blueprint/blob/main/BOOTSTRAP.md). After the install, start with week 1 of [[method#Adopting it|adopting the method]].
