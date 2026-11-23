import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { clusters, load, parseSince, readSessions, signature, transcriptFiles } from "./trace.ts";

// Synthetic transcripts in the record shapes documented at the top of trace.ts.
const NOW = Date.parse("2026-03-10T12:00:00Z");
const ts = (minAgo: number) => new Date(NOW - minAgo * 60000).toISOString();
const use = (sid: string, id: string, name: string, t: number) =>
  JSON.stringify({ type: "assistant", sessionId: sid, timestamp: ts(t), message: { content: [{ type: "tool_use", id, name, input: {} }] } });
const result = (sid: string, id: string, t: number, content: unknown, isError?: boolean, pd?: object) =>
  JSON.stringify({ type: "user", sessionId: sid, timestamp: ts(t), ...(pd ? { permissionDecision: pd } : {}), message: { content: [{ type: "tool_result", tool_use_id: id, content, ...(isError === undefined ? {} : { is_error: isError }) }] } });
const userText = (sid: string, t: number, content: unknown) => JSON.stringify({ type: "user", sessionId: sid, timestamp: ts(t), message: { content } });
const accept = { decision: "accept", source: "config" };

function put(root: string, rel: string, lines: string[]) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), lines.join("\n") + "\n");
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tr-"));
  put(root, "-work-alpha/s1.jsonl", [
    JSON.stringify({ type: "summary", summary: "ignored" }),
    "not json",
    use("s1", "a", "Bash", 60),
    result("s1", "a", 59, "Exit code 1\nfatal: not a git repository: /tmp/x/123", true, accept),
    use("s1", "a", "Bash", 60), // duplicate tool_use id on resume
    use("s1", "b", "Edit", 58),
    result("s1", "b", 57, "PreToolUse:Edit hook error: blocked by rule", true, { decision: "reject", source: "hook" }),
    use("s1", "c", "Write", 56),
    result("s1", "c", 55, "The user doesn't want to proceed with this tool use.", true, { decision: "reject", source: "user_reject" }),
    userText("s1", 54, "[Request interrupted by user]"),
    use("s1", "d", "Read", 53),
    result("s1", "d", 52, [{ type: "text", text: "ok" }], undefined, accept),
  ]);
  put(root, "-work-alpha/s1/subagents/agent-x1.jsonl", [
    use("s1", "e", "Bash", 50),
    result("s1", "e", 49, "fatal: not a git repository: /var/other/9", true),
    userText("s1", 48, [{ type: "text", text: "[Request interrupted by user for tool use]" }]),
  ]);
  put(root, "-work-beta/s2.jsonl", [
    use("s2", "a", "Bash", 30),
    result("s2", "a", 29, "fatal: not a git repository: ~/repo/7", true),
    use("s2", "b", "Bash", 28),
    result("s2", "b", 27, "PreToolUse:Bash hook denied: no", true), // no permissionDecision: text decides
  ]);
  put(root, "-work-old/s3.jsonl", [use("s3", "a", "Bash", 60 * 24 * 10), result("s3", "a", 60 * 24 * 10, "boom error", true)]);
  return root;
}

test("sessions: counts per session, subagents folded into the parent", () => {
  const s = readSessions(transcriptFiles(fixture()));
  const s1 = s.find((x) => x.session === "s1")!;
  expect(s1).toMatchObject({ project: "-work-alpha", subagents: 1, toolCalls: 5, toolErrors: 4, hookDenials: 1, interrupts: 2, rejected: 1, start: ts(60), end: ts(48) });
  expect(s.find((x) => x.session === "s2")).toMatchObject({ toolCalls: 2, toolErrors: 2, hookDenials: 1, rejected: 0, interrupts: 0 });
});

test("--since window drops sessions whose last record is older", () => {
  const root = fixture();
  expect(load(root, parseSince("2d"), NOW).map((s) => s.session)).toEqual(["s1", "s2"]);
  expect(load(root, parseSince("30d"), NOW).length).toBe(3);
  expect(() => parseSince("2w")).toThrow();
});

test("clusters: normalized signatures counted across sessions", () => {
  const cs = clusters(load(fixture(), parseSince("30d"), NOW), 2);
  expect(cs).toEqual([{ tool: "Bash", signature: "fatal: not a git repository: <path>", count: 3, sessions: 2 }]);
  expect(signature("Error at 2026-01-01T10:00:00Z in /a/b.ts:12 id 3f2a9c1d8e and 'x'")).toBe("Error at <ts> in <path>:<n> id <hex> and '<q>'");
});
