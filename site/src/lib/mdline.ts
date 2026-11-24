// mdline.ts: render one line of a vault note (as generated for the demo project) to HTML in the look of an
// Obsidian reading view: task checkboxes, tags, `done when:`, Tasks emoji dates, wikilinks, code spans.
// Used by the landing scenes; the text itself always comes from site/src/generated/kit.json.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CHECK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3"/></svg>';

/** Inline markup of a line's text (no list or heading prefix). */
export function inline(text: string): string {
  return text
    .split(/(`[^`]+`)/)
    .map((part) => {
      if (/^`[^`]+`$/.test(part)) return `<code>${esc(part.slice(1, -1))}</code>`;
      return esc(part)
        .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => `<span class="wl">${a ?? t}</span>`)
        .replace(/(^|\s)(#[\w/-]+)/g, (_, sp, tag) => `${sp}<span class="tag${tag === "#agent-ready" ? " tag--ready" : ""}">${tag}</span>`)
        .replace(/done when:/g, '<span class="dw">done when:</span>')
        .replace(/([🔺⏫🔼🔽⏬🛫⏳📅✅])\s?(\d{4}-\d{2}-\d{2})?/gu, (_, e, d) => `<span class="meta">${e}${d ? " " + d : ""}</span>`)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    })
    .join("");
}

export type MdLine = { kind: "h1" | "h2" | "task" | "done" | "p" | "li" | "quote" | "blank"; html: string };

export function checkbox(done: boolean): string {
  return `<span class="cb${done ? " cb--x" : ""}" aria-label="${done ? "done" : "open"}">${done ? CHECK : ""}</span>`;
}

export function mdLine(line: string): MdLine {
  if (!line.trim()) return { kind: "blank", html: "" };
  let m: RegExpExecArray | null;
  if ((m = /^# (.+)$/.exec(line))) return { kind: "h1", html: inline(m[1]!) };
  if ((m = /^## (.+)$/.exec(line))) return { kind: "h2", html: inline(m[1]!) };
  if ((m = /^- \[( |x)\] (.*)$/.exec(line))) {
    const done = m[1] === "x";
    return { kind: done ? "done" : "task", html: `${checkbox(done)}<span class="txt">${inline(m[2]!)}</span>` };
  }
  if ((m = /^- (.*)$/.exec(line))) return { kind: "li", html: `• ${inline(m[1]!)}` };
  if ((m = /^> ?(.*)$/.exec(line))) return { kind: "quote", html: inline(m[1]!.replace(/^\[!\w+\]-?\s*/, "")) };
  return { kind: "p", html: inline(line) };
}

/** Frontmatter key/value pairs and the body lines of a note. */
export function splitNote(text: string): { props: [string, string][]; body: string[] } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const props: [string, string][] = [];
  if (m)
    for (const l of m[1]!.split("\n")) {
      const kv = /^([\w-]+):\s*(.*)$/.exec(l);
      if (kv) props.push([kv[1]!, kv[2]!.replace(/^(['"])(.*)\1$/, "$2")]);
    }
  return { props, body: text.slice(m ? m[0].length : 0).split("\n") };
}
