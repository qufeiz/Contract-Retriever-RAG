// The ROUTER — a REAL DeepSeek call that decides which source(s) are relevant and
// (for structured) which named intents to run, and REPORTS its decision. This is
// the differentiator the client asked for: not "embed everything and search", but
// a routing decision over heterogeneous sources.
import { chat } from "./llm.ts";
import { INTENTS } from "./intents.ts";
import { DOCUMENTS } from "./documents.ts";

export type RoutePlan = {
  sources: ("structured" | "documents")[];
  intents: { name: string; params: Record<string, any> }[];
  docFilter: string | null; // restrict RAG to one doc id, or null = all docs
  rationale: string;
};

const intentCatalog = INTENTS.map(
  (i) => `- ${i.name} (feature: ${i.feature}): ${i.description}`
).join("\n");
const docCatalog = DOCUMENTS.map((d) => `- ${d.doc}: ${d.label}`).join("\n");

const SYSTEM = `You are the query ROUTER for a business knowledge assistant. You decide which data source(s) can answer a question and, for the structured store, which named query intents to run. You DO NOT answer the question.

Sources:
1. "structured" — a read-only SQLite database of school/business operations. Answer structured questions by selecting INTENTS (you cannot write SQL):
${intentCatalog}
2. "documents" — PDF case files (RAG over text chunks). Use for narrative/legal/qualitative questions:
${docCatalog}

Rules:
- The structured (school operations) and document (Carter family-court case) domains are UNRELATED. Never assume a join between them.
- Pick "structured", "documents", or BOTH when a question spans them (e.g. list data AND summarize what a document says).
- For each structured intent, supply params it needs (e.g. {"days": 90}, {"vendor": "Acme"}, {"department": "Sales"}). Omit params you don't have.
- If documents are relevant to one specific case file, set docFilter to its id; otherwise null.

Respond with ONLY JSON: {"sources": [...], "intents": [{"name": "...", "params": {...}}], "docFilter": null, "rationale": "one short sentence"}.`;

export async function routeQuestion(question: string): Promise<RoutePlan> {
  const raw = await chat(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: question },
    ],
    { json: true, temperature: 0 }
  );
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Safe deg: if the router output is unparseable, fall back to querying both.
    return {
      sources: ["structured", "documents"],
      intents: [],
      docFilter: null,
      rationale: "router output unparseable — querying all sources and letting relevance decide",
    };
  }
  return normalizePlan(parsed);
}

export function normalizePlan(parsed: any): RoutePlan {
  const validIntents = new Set(INTENTS.map((i) => i.name));
  const sources = Array.isArray(parsed.sources)
    ? parsed.sources.filter((s: string) => s === "structured" || s === "documents")
    : [];
  const intents = Array.isArray(parsed.intents)
    ? parsed.intents
        .filter((i: any) => i && validIntents.has(i.name))
        .map((i: any) => ({ name: i.name, params: i.params ?? {} }))
    : [];
  // Coherence: if structured intents were chosen, ensure "structured" is in sources.
  if (intents.length && !sources.includes("structured")) sources.push("structured");
  return {
    sources: sources.length ? sources : ["structured", "documents"],
    intents,
    docFilter: typeof parsed.docFilter === "string" ? parsed.docFilter : null,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
  };
}
