// Icon per worker name; a worker added to payload/claude/agents later gets the generic one.
const ICONS: Record<string, string> = {
  scout: "lucide:radar",
  operator: "lucide:wrench",
  verifier: "lucide:scale",
  reviewer: "lucide:eye",
  researcher: "lucide:globe",
  "vault-scribe": "lucide:feather",
};
export const workerIcon = (name: string) => ICONS[name] ?? "lucide:bot";
