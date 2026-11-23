---
name: prompt-audit
description: Ground prompt work in Anthropic's current published guidance instead of training-data habit, then measure the prompts against the transcripts. Fetches Anthropic's prompting pages (general best practices, the guide for each model in use, effort, skill authoring, Claude Code best practices) and engineering posts, diffs them against the last fetch, and checks the prompt files against both the guidance and what the agent actually did. Use before a large rewrite of a prompt-bearing file (CLAUDE.md, an output style, agents/*.md, a SKILL.md, the brief for a dispatched agent), and for "improve my prompting", "does the agent follow the output style", "what does Anthropic say about X", "why does the agent ignore this instruction". Not for recurring tool errors (skill `retro`).
---

# Prompt audit: the docs first, then the transcripts

An agent asked to improve a prompt writes from training data, which says little about prompting the model you run today. Anthropic publishes and revises exactly that: a general page, one guide per model, with measured results. This skill reads the current pages before an edit, and reads the transcripts to see whether the rules already in place are followed.

## Sources (each returned HTTP 200 when this skill was written)

| page | URL |
|---|---|
| index of every doc page, raw markdown | https://platform.claude.com/llms.txt |
| prompt engineering overview | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview.md |
| general prompting best practices | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices.md |
| guide for one model (example) | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5.md |
| effort | https://platform.claude.com/docs/en/build-with-claude/effort.md |
| skill authoring | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md |
| Claude Code best practices | https://code.claude.com/docs/en/best-practices.md |
| engineering posts (index; `lastmod` in the sitemap says what is new) | https://www.anthropic.com/engineering, https://www.anthropic.com/sitemap.xml |

Model guides are added and renamed with each release, so do not hard-code them: take every `prompting-claude-*.md` URL from `llms.txt`. The `.md` suffix returns raw markdown, which is quotable with line numbers; the HTML page is not.

## Procedure

1. **Fetch** into `~/.claude/retro/docs/prompting/<YYYY-MM-DD>/` (outside git):
   ```bash
   D=~/.claude/retro/docs/prompting/$(date +%F); mkdir -p "$D"
   curl -s https://platform.claude.com/llms.txt -o "$D/llms.txt"
   rg -o 'https://platform\.claude\.com/docs/en/[^ )]+\.md' "$D/llms.txt" | rg 'prompt-engineering/|/effort\.md|agent-skills/best-practices\.md' | sort -u > "$D/urls.txt"
   echo https://code.claude.com/docs/en/best-practices.md >> "$D/urls.txt"
   while read -r u; do curl -s "$u" -o "$D/$(basename "$u")"; done < "$D/urls.txt"
   ```
   A page that came back empty or as HTML is a failed fetch: say so, do not reason from it.
2. **Diff** against the previous fetch directory: `diff -rq <prev> "$D"` for new and changed pages, then per changed page the headings (`rg '^#{1,4} ' <file>`) on both sides. Report new model guides, added and removed headings, and engineering posts with a `lastmod` after the previous fetch. Read the posts whose title concerns agents, context, tools, skills or evals.
3. **Read the guidance for the file in scope.** The guide for the model the file runs on, in full (an agent file with `model: haiku` is read against the haiku guide), plus the general page's sections on clarity, context, examples, tool use, output format and agentic work. Quote guidance from the cached raw page with its line number. A summary of a page, by WebFetch or a subagent, is unverified: summarisers invent details.
4. **Read the transcripts.** `bun ~/.claude/scripts/trace.ts sessions --since 30d` for the sessions in scope, then check the rules the prompt sets against what the agent did. For an output style: count the final messages that break a stated rule (a banned word, a missing required section, an over-budget report), for example `rg --no-ignore -c '<banned phrase>' ~/.claude/projects/*/*.jsonl`. For an agent file: whether its finals carry the report format and stay inside the line budget. Read a sample of matches before trusting a regex count. Also look at how <<NAME>> reacted: corrections, "continue" nudges, rejected tool calls.
5. **One table row per candidate**: guide claim (page:line, quoted), prompt location (file:line), transcript measure, verdict (confirmed, refuted, untestable from transcripts), proposed change. Refuted candidates stay in the table so the next audit does not re-derive them.
6. **Apply** edits to git-tracked prompt files in the same turn, each with its undo command (`git -C ~/.claude revert <hash>`). After the edit, the same transcript measure run again from the edit date is the before/after evidence.

## Reading the guidance

- A technique is measured on the model the page names; carry it to another model only after checking that model's guide.
- Guidance that contradicts a rule <<NAME>> set deliberately (terseness, routing) is a decision for <<NAME>>: present both with the guide's stated effect.
- A sample paragraph from a guide is a starting point to test, not text to paste.
- A lexical ban the transcripts show at near-zero violations is working; rewrite the rules the transcripts show failing, not the ones that read badly.

## Constraints

- Transcript content stays in the session; the report carries counts and short quotes only.
- No `claude -p` from a script. The model stage is this session reading the cached pages.
