import { test, expect } from "@playwright/test";

// contract-intelligence feature gate (permanent regression guard).
// Derived from docs/features/contract-intelligence/03-tests.md Part 5.
// Pinned anchor asOfDate=2026-06-09 → 38 contracts, $18,924,883.79.
// Removable-handler-proof: stub retrieval/route → these go red.

async function ask(page: import("@playwright/test").Page, q: string) {
  await page.goto("/");
  await page.getByLabel("Ask a question").fill(q);
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("answer")).toBeVisible({ timeout: 60_000 });
}

const CARTER_LEAK = /child support|custody|\bJoni\b|\bMichel\b|Final Judgment|home sale within/i;

test("F-A: spec Q1 (EN) → 38 count, $18.9M total, cited row, honest penalty, NO Carter leak", async ({
  page,
}) => {
  await ask(
    page,
    "What contracts expire in the next 90 days and what penalties are defined in those contracts?"
  );

  // Routed SQL-only (the cross-domain-leak guard: no documents source).
  await expect(page.getByTestId("source-structured")).toBeVisible();
  await expect(page.getByTestId("source-documents")).toHaveCount(0);

  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/38\s+contracts/i); // verifiable count
  await expect(answer).toContainText(/18,924,883\.79/); // combined annual value
  await expect(answer).toContainText(/\[S:contracts#\d+\]/); // a real row citation
  await expect(answer).toContainText(/not available|not contain|no penalty/i); // honest penalty

  // J1 — the worst-case gate: NO Carter case-file content in a contract answer.
  await expect(answer).not.toContainText(CARTER_LEAK);

  // Content-fidelity (generic + validateContractAnswer) passed.
  await expect(page.getByTestId("validation")).toContainText(/✓\s*Grounded/);
  await expect(page.getByTestId("validation")).not.toContainText(/Rejected|ungrounded/i);
});

test("F-B: spec Q1 in Hebrew → same 38 / $18.9M / honest penalty, NO Carter leak", async ({
  page,
}) => {
  await ask(page, "אילו חוזים יפוגו ב-90 הימים הקרובים ומהם הקנסות המוגדרים באותם חוזים?");

  await expect(page.getByTestId("source-structured")).toBeVisible();
  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/38/);
  await expect(answer).toContainText(/18,924,883\.79/);
  await expect(answer).not.toContainText(CARTER_LEAK);
  await expect(page.getByTestId("validation")).toContainText(/✓\s*Grounded/);
  await expect(page.getByTestId("validation")).not.toContainText(/Rejected|ungrounded/i);
});

test("F-C: single Skalith contract → real value cited, honest no-penalty, NO Carter leak", async ({
  page,
}) => {
  await ask(
    page,
    "Tell me about the Skalith Project Manager contract expiring in July, including any early-termination penalty."
  );

  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/\[S:contracts#269\]/); // the Skalith Project Manager row
  await expect(answer).toContainText(/25,629\.50/); // its real annual cost, cited to the row
  await expect(answer).toContainText(/not available|not contain|no penalty|no early-termination/i);
  await expect(answer).not.toContainText(CARTER_LEAK);
  await expect(page.getByTestId("validation")).toContainText(/✓\s*Grounded/);
  await expect(page.getByTestId("validation")).not.toContainText(/Rejected|ungrounded/i);
});
