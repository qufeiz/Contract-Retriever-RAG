// The orchestrator: route → retrieve (SQL + RAG) → grounded generation → validate.
// Returns the answer, the routing decision (reported to the user), and the
// evidence (every cited row/page), so the UI can show traceability.
import { routeQuestion, type RoutePlan } from "./router.ts";
import { getIntent } from "./intents.ts";
import { vectorSearch, type SqlRow, type DocChunk } from "./retrieval.ts";
import { embedQuery } from "./embeddings.ts";
import { chat } from "./llm.ts";
import { sqlToken, pdfToken } from "./citations.ts";
import { validateAnswer, type Evidence } from "./validate-answer.ts";
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
  if (route.sources.includes("structured")) {
    for (const intent of route.intents) {
      const def = getIntent(intent.name);
      if (!def) continue;
      try {
        rows.push(...def.run(intent.params, TODAY));
      } catch {
        /* a bad intent never crashes the answer */
      }
    }
  }

  let chunks: DocChunk[] = [];
  if (route.sources.includes("documents")) {
    const qEmbedding = await embedQuery(question);
    chunks = vectorSearch(qEmbedding, 6, route.docFilter ?? undefined);
  }

  // 3. Build evidence with citation tokens
  const evRows = rows.map((r) => ({ ...r, token: sqlToken(r.table, r.id) }));
  const evChunks = chunks.map((c) => ({ ...c, token: pdfToken(c.doc, c.page) }));
  const evidence: Evidence = {
    rows: evRows.map((r) => ({ table: r.table, id: r.id })),
    chunks: evChunks.map((c) => ({ doc: c.doc, page: c.page })),
  };

  // 4. GROUNDED GENERATION
  const answer = await generateGrounded(question, evRows, evChunks, TODAY);

  // 5. VALIDATE (content-fidelity gate)
  const validation = validateAnswer(answer, evidence);

  return {
    question,
    route,
    answer,
    evidence: {
      rows: evRows.map((r) => ({ table: r.table, id: r.id, token: r.token, data: r.data })),
      chunks: evChunks.map((c) => ({ doc: c.doc, page: c.page, token: c.token, text: c.text })),
    },
    validation: { ok: validation.ok, reasons: validation.reasons },
  };
}

function docLabel(doc: string): string {
  return DOCUMENTS.find((d) => d.doc === doc)?.label ?? doc;
}

async function generateGrounded(
  question: string,
  rows: { token: string; table: string; data: Record<string, unknown> }[],
  chunks: { token: string; doc: string; page: number; text: string }[],
  today: string
): Promise<string> {
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
- Attach an inline citation token to EVERY factual claim, copied verbatim from the evidence (e.g. [S:contracts#12] for a row, [P:family-court#14] for a page).
- Use ONLY tokens that appear in the evidence below. Never invent a citation.
- The structured and document sources are unrelated; do not merge or join them.
- If the evidence does not contain the answer (e.g. penalty terms are not in the data), say so plainly and do NOT fabricate. An honest "not present in the available sources" is correct.
- Be concise and concrete. When listing many rows, summarize the count and cite representative rows.`;

  const user = `Today's date is ${today}. Any date filtering in the structured evidence (e.g. "next 90 days") was already computed relative to today, so the rows below are the answer set — do not say the date is unknown.

Question: ${question}

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
