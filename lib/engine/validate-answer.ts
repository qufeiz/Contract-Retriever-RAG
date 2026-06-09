// validateAnswer() — the pure content-fidelity gate.
//
// This is the gate that turns "fluent but ungrounded" into a RED result instead
// of a shipped lie. It runs in the answer path AND is pinned by a unit test that
// must pass every golden answer and fail every toy (a fluent-but-uncited answer,
// or a citation that resolves to no retrieved evidence).
//
// Rules (all structural — no LLM):
//  1. Every citation token in the answer must RESOLVE to evidence retrieved this
//     turn (no fabricated row ids / page numbers).
//  2. An answer that makes factual claims must carry at least one citation — a
//     fluent paragraph with zero citations is rejected (the toy failure).
//  3. Multi-source citations stay separate: a [S:...] and a [P:...] are each
//     checked against their own evidence namespace; we never accept one for the
//     other.
//
// An honest "this is not in the available sources" answer is ALLOWED (it makes no
// uncited factual claim) — that's the grounding discipline, not a failure.

import { extractCitationTokens, resolvableTokenSet } from "./citations.ts";

export type Evidence = {
  rows: { table: string; id: number }[];
  chunks: { doc: string; page: number }[];
};

export type ValidationResult = {
  ok: boolean;
  reasons: string[];
  unresolved: string[]; // citation tokens with no backing evidence
};

// A claim is a sentence asserting a fact. We approximate "makes a factual claim"
// as: contains a digit, a currency amount, or a quantified/asserting keyword —
// while excluding explicit not-found disclaimers.
const NOT_FOUND_RE =
  /\b(not (present|available|found|in the (available )?sources?)|no (matching|relevant) (data|records?|sources?)|the (available )?sources? do(es)? not|cannot find|could not find)\b/i;

const FACTUAL_SIGNAL_RE =
  /(\$[\d,]+|\b\d+\b|\bexpire|\boverdue|\bcustody|\bsalary|\bcontract|\binvoice|\bpenalt|\bjudg|\bawarded|\btotal\b)/i;

export function validateAnswer(answer: string, evidence: Evidence): ValidationResult {
  const reasons: string[] = [];
  const resolvable = resolvableTokenSet(evidence);
  const tokens = extractCitationTokens(answer);
  const unresolved = tokens.filter((t) => !resolvable.has(t));

  // Rule 1 — every citation resolves
  if (unresolved.length > 0) {
    reasons.push(
      `answer cites evidence that was not retrieved this turn: ${unresolved.join(", ")}`
    );
  }

  // Strip not-found disclaimer sentences before deciding "makes a factual claim".
  const sentences = answer.split(/(?<=[.!?])\s+/);
  const factualSentences = sentences.filter(
    (s) => FACTUAL_SIGNAL_RE.test(s) && !NOT_FOUND_RE.test(s)
  );

  // Rule 2 — a factual answer must carry at least one citation
  if (factualSentences.length > 0 && tokens.length === 0) {
    reasons.push(
      "answer makes factual claims but carries no citations (ungrounded — the toy failure)"
    );
  }

  return { ok: reasons.length === 0, reasons, unresolved };
}
