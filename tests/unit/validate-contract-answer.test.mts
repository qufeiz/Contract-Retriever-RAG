import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContractAnswer } from "../../lib/engine/validate-contract-answer.ts";

// Mirrors docs/features/contract-intelligence/03-tests.md Part 3 — passes every
// golden (A/B/C) and fails every toy/leaking answer.

// ── GOLDEN answers MUST pass ────────────────────────────────────────────────

test("golden A: 38-count, total, cited row, honest penalty-unavailable", () => {
  const a = `38 contracts expire between 2026-06-09 and 2026-09-07, with a combined annual value of $18,924,883.79. The earliest: Dental Hygienist (Edgepulse) 2026-06-11 $779,823.65 [S:contracts#12]. On penalties: penalty terms are not available — the contract dataset has no penalty field and no vendor-contract documents are loaded. I won't guess them.`;
  const r = validateContractAnswer(a);
  assert.equal(r.ok, true, r.reasons.join("; "));
});

test("golden C: single contract, real value cited, no penalty source", () => {
  const a = `The Project Manager / Skalith contract expires 2026-07-09 with an annual value of $25,629.50 [S:contracts#410]. There is no early-termination penalty information available — the contract data has no penalty field and no contract document is loaded.`;
  const r = validateContractAnswer(a);
  assert.equal(r.ok, true, r.reasons.join("; "));
});

// ── TOY / leaking answers MUST fail ─────────────────────────────────────────

test("toy: vague quantifier instead of a count", () => {
  const a = `Several contracts are expiring soon [S:contracts#12]. Penalty terms are not available.`;
  const r = validateContractAnswer(a);
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(" "), /vague quantifier|verifiable contract count/i);
});

test("toy: generic penalty prose (ungrounded)", () => {
  const a = `38 contracts expire in the next 90 days [S:contracts#12]. Penalties typically include early-termination fees and notice periods.`;
  const r = validateContractAnswer(a);
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(" "), /penalt/i);
});

test("toy: fabricated penalty figure", () => {
  const a = `38 contracts expire soon [S:contracts#12]. The early-termination penalty is a fee of $5,000 plus 30 days notice.`;
  const r = validateContractAnswer(a);
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(" "), /fabricated penalty/i);
});

test("toy: cross-domain leak — Carter content in a contract answer (the worst case)", () => {
  const a = `38 contracts expire soon [S:contracts#12]. As for penalties, the Final Judgment orders a home sale within 12 months and child support of $1,285/month.`;
  const r = validateContractAnswer(a);
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(" "), /cross-domain leak/i);
});

test("toy: no citation present", () => {
  const a = `38 contracts expire between 2026-06-09 and 2026-09-07. Penalty terms are not available.`;
  const r = validateContractAnswer(a);
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(" "), /no contract row citation/i);
});
