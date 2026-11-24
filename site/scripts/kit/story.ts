// story.ts: the session the landing scenes replay, for the demo project in demo.ts.
//
// The narrative text (what the shop owner asked, what each lane reported) is fiction written here. Everything
// it leans on is checked against the kit: every worker it names must exist in payload/claude/agents, the
// verdict words must be the ones the verifier returns, the lanes are the tasks agent-queue.ts actually
// listed, and the hook decisions are the scripts' own output.
import { REQUEST } from "./demo.ts";
import { worker, type Worker } from "./agents.ts";
import { SourceError } from "./source.ts";

export type Lane = { worker: string; model: string; tools: string; task: string; report: string };

/** Task texts from agent-queue.ts output (`<file>:<line> <text>`), tags and the done-when tail removed. */
export function queueTasks(out: string): string[] {
  return out
    .split("\n")
    .filter((l) => !l.startsWith("#"))
    .map((l) => l.replace(/^.*?\.md:\d+ /, "").replace(/\s+#agent-ready.*$/, "").trim())
    .filter(Boolean);
}

const REPORTS: Record<string, string> = {
  [REQUEST.task]: "Status: Done · feat/email-receipt · 3 files · Observed: tests pass",
  "Add a size filter to the catalogue": "Status: Done · feat/size-filter · /catalogue?size=m lists 6 of 6 size M",
};

export function lanes(roster: Worker[], queueOut: string): Lane[] {
  const tasks = queueTasks(queueOut);
  const lane = (name: string, task: string, report: string): Lane => {
    const w = worker(roster, name);
    return { worker: w.name, model: w.model, tools: w.toolMode === "allowlist" ? w.tools.join(", ") : `all except ${w.tools.join(", ")}`, task, report };
  };
  return [
    lane("scout", "Map the checkout flow and the mailer", "4 call sites of placeOrder(); mailer in src/mail/; no receipt template yet"),
    ...tasks.map((t) => {
      const report = REPORTS[t];
      if (!report) throw new SourceError("payload/claude/scripts/agent-queue.ts", `listed "${t}", which the landing story has no lane report for`);
      return lane("operator", t, report);
    }),
    lane("researcher", "Can the mail provider send from the shop's own domain?", "Yes, after a DNS check; 2 claims, each with its URL and an exact quote"),
  ];
}

export function verify(verdicts: string[]) {
  for (const v of ["REFUTED", "REVERIFIED"])
    if (!verdicts.includes(v)) throw new SourceError("payload/claude/agents/verifier.md", `the verify scene shows ${v}, which the verifier no longer returns (${verdicts.join(", ")})`);
  return {
    claim: "Observed: tests pass [verified: bun test checkout] 12 pass",
    assert: "[ASSERT bun test checkout, in a clean copy of feat/email-receipt] 12 pass, 0 fail; a failure refutes",
    command: "bun test checkout",
    output: ["checkout/receipt.test.ts:", "✓ builds the receipt body", "✗ sends one receipt per order", "  expected 1 mail in the outbox, got 2", "", " 11 pass", " 1 fail"],
    verdict: "REFUTED",
    finding: "The retry path sends the mail twice. Back to the operator lane, with this output.",
    rerun: { output: [" 12 pass", " 0 fail"], verdict: "REVERIFIED" },
    verdicts,
  };
}

export const DECIDE = {
  question: "Which address sends the receipt mail?",
  header: "Sender",
  options: [
    { label: "Shop domain, through the mail provider (Recommended)", description: "The provider sends from the shop's own domain after a DNS check (researcher, docs quote), so the receipt carries the shop logo." },
    { label: "The payment provider's receipt", description: "No code to keep, but its template cannot show the logo or the order lines." },
    { label: "No receipt mail", description: "Close the task; the order page keeps showing the receipt." },
  ],
};
