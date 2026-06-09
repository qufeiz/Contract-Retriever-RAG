// The orchestrator: route → retrieve (SQL + RAG) → grounded generation → validate.
// Returns the answer, the routing decision (reported to the user), and the
// evidence (every cited row/page), so the UI can show traceability.
import { routeQuestion, type RoutePlan } from "./router.ts";
import { getIntent, type IntentSummary } from "./intents.ts";
import { vectorSearch, type SqlRow, type DocChunk } from "./retrieval.ts";
import { embedQuery } from "./embeddings.ts";
import { chat } from "./llm.ts";
import { sqlToken, pdfToken } from "./citations.ts";
import { validateAnswer, type Evidence } from "./validate-answer.ts";
import { validateContractAnswer } from "./validate-contract-answer.ts";
import { validateCaseAnswer } from "./validate-case-answer.ts";
import { validateNoFabrication } from "./validate-maintenance-answer.ts";
import { DOCUMENTS } from "./documents.ts";

export type AnswerResult = {
  question: string;
  route: RoutePlan;
  answer: string;
  evidence: {
    rows: { table: string; id: number; token: string; data: Record<string, unknown> }[];
    chunks: { doc: string; page: number; token: string; text: string }[];
  };
  validation: { ok: boolean; reasons: string[] };
};

const TODAY = process.env.ASSISTANT_TODAY ?? new Date().toISOString().slice(0, 10);

export async function answerQuestion(question: string): Promise<AnswerResult> {
  // 1. ROUTE (real LLM decision)
  const route = await routeQuestion(question);

  // 2. RETRIEVE
  const rows: SqlRow[] = [];
  const summaries: IntentSummary[] = [];
  if (route.sources.includes("structured")) {
    for (const intent of route.intents) {
      const def = getIntent(intent.name);
      if (!def) continue;
      try {
        const result = def.run(intent.params, TODAY);
        rows.push(...result.rows);
        if (result.summary) summaries.push(result.summary);
      } catch (e) {
        // A bad intent never crashes the answer, but surface it in logs so a
        // misconfigured retrieval (e.g. a missing bundled index) is debuggable.
        console.error(`intent ${intent.name} failed:`, e instanceof Error ? e.message : e);
      }
    }
  }

  let chunks: DocChunk[] = [];
  if (route.sources.includes("documents")) {
    const qEmbedding = await embedQuery(question);
    // Retrieve across ALL case documents (NO doc filter) then ensure cross-document
    // coverage, so corroboration and conflict-surfacing across BOTH Carter PDFs are
    // possible — locking to a single doc would defeat both. The router's docFilter is
    // intentionally not applied here: the two case documents are companions and the
    // feature's value (corroboration / conflict) depends on seeing both.
    const raw = vectorSearch(qEmbedding, 12);
    chunks = diversifyByDoc(raw, 8);
  }

  // 3. Build evidence with citation tokens
  const evRows = rows.map((r) => ({ ...r, token: sqlToken(r.table, r.id) }));
  const evChunks = chunks.map((c) => ({ ...c, token: pdfToken(c.doc, c.page) }));
  const evidence: Evidence = {
    rows: evRows.map((r) => ({ table: r.table, id: r.id })),
    chunks: evChunks.map((c) => ({ doc: c.doc, page: c.page })),
  };

  // For the maintenance domain, give generation the table's schema so it can
  // HONESTLY refuse overdue/paid/suspension/customer-debt questions by citing the
  // columns that DO exist as evidence of the absent concept (not fabricate one).
  const schemaContext = buildSchemaContext(route);

  // 4. GROUNDED GENERATION
  const answer = await generateGrounded(question, evRows, evChunks, summaries, schemaContext, TODAY);

  // 5. VALIDATE — generic content-fidelity + the per-feature gate (contracts).
  const validation = validateAnswer(answer, evidence);
  const reasons = [...validation.reasons];
  const isContractTurn = route.intents.some((i) => i.name.startsWith("contracts_"));
  if (isContractTurn) {
    const cv = validateContractAnswer(answer);
    reasons.push(...cv.reasons);
  }
  // A case-file turn: documents only, no structured intents (the Carter case Q&A).
  const isCaseTurn =
    route.sources.includes("documents") && !route.sources.includes("structured") && evChunks.length > 0;
  if (isCaseTurn) {
    const cv = validateCaseAnswer(answer);
    reasons.push(...cv.reasons);
  }
  const isMaintenanceTurn = route.intents.some((i) => i.name === "maintenance_spend");
  if (isMaintenanceTurn) {
    const mv = validateNoFabrication(answer);
    reasons.push(...mv.reasons);
  }

  return {
    question,
    route,
    answer,
    evidence: {
      rows: evRows.map((r) => ({ table: r.table, id: r.id, token: r.token, data: r.data })),
      chunks: evChunks.map((c) => ({ doc: c.doc, page: c.page, token: c.token, text: c.text })),
    },
    validation: { ok: reasons.length === 0, reasons },
  };
}

function docLabel(doc: string): string {
  return DOCUMENTS.find((d) => d.doc === doc)?.label ?? doc;
}

// Schema evidence for the honest-refusal path. When a maintenance question asks
// for a concept the data lacks (overdue/paid/due/suspension/who-owes), the answer
// must cite the EXISTING column set to prove the absence and refuse — not invent.
function buildSchemaContext(route: RoutePlan): string {
  if (!route.intents.some((i) => i.name === "maintenance_spend")) return "";
  const cols = "Ticket ID (a category label), Vendor, Invoice, Labor Cost, Parts Cost, Total Cost, Completion Date";
  return [
    `SCHEMA of the maintenance table (school data 3.csv) — these are the COMPLETE set of columns: ${cols}.`,
    `This data has NO payment-status, paid/unpaid, due-date, or service-suspension field, and there is NO service-agreement document.`,
    `The vendors are maintenance providers the school PAYS — they are NOT customers who owe money.`,
    `If the question asks about overdue payments, who owes us, paid/unpaid status, or service-suspension terms: you CANNOT answer it from this data. Say so honestly, naming the existing columns in PROSE as the evidence of the absent field (do NOT write a "[SCHEMA]" tag — describe the columns in words), do NOT invent an overdue list or relabel vendors as debtors, and then offer the spend analysis the data CAN do (e.g. "total maintenance spend is $40,597.00 across 750 tickets; I can break it down by vendor or year").`,
  ].join(" ");
}

// Keep the top chunks but guarantee each represented document gets at least a
// couple of slots, so a corroborating/conflicting passage in a lower-ranked doc
// isn't crowded out by a higher-ranked one. Preserves overall score order.
function diversifyByDoc(chunks: DocChunk[], limit: number): DocChunk[] {
  const perDocFloor = 2;
  const byDoc = new Map<string, DocChunk[]>();
  for (const c of chunks) {
    if (!byDoc.has(c.doc)) byDoc.set(c.doc, []);
    byDoc.get(c.doc)!.push(c);
  }
  const picked = new Set<DocChunk>();
  // First pass: each doc's top `perDocFloor`.
  for (const list of byDoc.values()) for (const c of list.slice(0, perDocFloor)) picked.add(c);
  // Then fill remaining slots in global score order.
  for (const c of chunks) {
    if (picked.size >= limit) break;
    picked.add(c);
  }
  return chunks.filter((c) => picked.has(c)).slice(0, limit);
}

async function generateGrounded(
  question: string,
  rows: { token: string; table: string; data: Record<string, unknown> }[],
  chunks: { token: string; doc: string; page: number; text: string }[],
  summaries: IntentSummary[],
  schemaContext: string,
  today: string
): Promise<string> {
  const aggLines =
    summaries.length === 0
      ? ""
      : summaries
          .map((s) => {
            const t = s.total
              ? `, ${s.total.name} = ${s.total.value.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}`
              : "";
            const note = s.note ? ` ${s.note}` : "";
            return `- ${s.label}: count = ${s.count}${t} (verified SQL aggregate over the cited rows).${note}`;
          })
          .join("\n");
  const structuredEvidence =
    rows.length === 0
      ? "(no structured rows retrieved)"
      : rows
          .map((r) => `${r.token} ${JSON.stringify(r.data)}`)
          .join("\n");
  const docEvidence =
    chunks.length === 0
      ? "(no document chunks retrieved)"
      : chunks
          .map((c) => `${c.token} (${docLabel(c.doc)}, page ${c.page}): ${c.text}`)
          .join("\n\n");

  const system = `You answer business questions using ONLY the evidence provided. Rules:
- Attach an inline citation token to EVERY factual claim, copied VERBATIM from the evidence (e.g. [S:contracts#12] for a row, [P:family-court#14] for a page).
- A citation token is ALWAYS a single id: [S:contracts#12]. NEVER write a range like [S:contracts#12–#47] and NEVER merge ids — cite each row with its own token.
- When you list sample rows, put each row's OWN token at the end of that row's line.
- Use ONLY tokens that appear in the evidence below. Never invent a citation.
- ALWAYS include citation tokens, in EVERY language — if you answer in Hebrew or another language, the [S:...]/[P:...] tokens still appear verbatim (they are not translated).
- The structured and document sources are unrelated; do not merge or join them.
- If the evidence does not contain the answer (e.g. penalty terms are not in the data), say so plainly: write "not available" / "are not available in the data" (for documents: "not stated in the case file"). Do NOT fabricate, and do NOT pull from an unrelated source.
- CORROBORATION: if the SAME fact appears in TWO different documents (e.g. both the court file AND the narrative), cite BOTH (keep the two citations distinct) and say it is corroborated across the documents — stronger attribution. Actively check whether a second document also supports the fact before answering from just one.
- CONFLICT (critical): before answering a question about a specific value (a date, an amount, a name), you MUST scan EVERY evidence passage and collect EVERY value it gives for that thing — including values inside headers/cover sheets (e.g. a cover sheet line "Filed: 10 February 2026" is a filing date even though it's terse). If you find two DIFFERENT values for the same thing (e.g. "10 February 2026" on a cover sheet vs "February 3, 2026" in a narrative — note these are DIFFERENT dates), you MUST surface BOTH with their own citations and state the sources conflict. Two dates are "the same" only if they are literally the same day. NEVER call conflicting values "corroborated", and never silently pick one — hiding a conflict is a failure.
- Be concise and concrete. When stating a count or total, use the VERIFIED AGGREGATES exactly, then list a few representative rows each with its own token.`;

  const user = `Today's date is ${today}. Any date filtering in the structured evidence (e.g. "next 90 days") was already computed relative to today, so the rows below are the answer set — do not say the date is unknown.

Question: ${question}
${schemaContext ? `\nSCHEMA EVIDENCE (use this to honestly refuse questions about fields the data lacks, citing the columns that exist):\n${schemaContext}\n` : ""}${aggLines ? `\nVERIFIED AGGREGATES (state these exact figures — they are computed over the full filtered set, not just the sample rows shown):\n${aggLines}\n` : ""}
STRUCTURED EVIDENCE (SQLite rows):
${structuredEvidence}

DOCUMENT EVIDENCE (PDF chunks):
${docEvidence}

Answer the question grounded strictly in this evidence, with inline citations.`;

  return chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0 }
  );
}
