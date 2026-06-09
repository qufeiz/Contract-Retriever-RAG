import { test, expect } from "@playwright/test";

// maintenance-spend-intelligence feature gate (permanent regression guard).
// Derived from docs/features/maintenance-spend-intelligence/03-tests.md Part 4.
// The marquee gate: HONEST REFUSAL of the overdue question (no fabricated list).

async function ask(page: import("@playwright/test").Page, q: string) {
  await page.goto("/");
  await page.getByLabel("Ask a question").fill(q);
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("answer")).toBeVisible({ timeout: 60_000 });
}

// A fabricated-overdue pattern that must NEVER appear (the failure this feature prevents).
const FABRICATED_OVERDUE = /\bowes? (us )?\$|overdue (payments?|balance) (of|totaling|totalling) \$|suspended after \d+ days/i;

test("F-A: overdue question → HONEST REFUSAL, schema-cited, NO fabricated overdue list", async ({
  page,
}) => {
  await ask(page, "Which customers have overdue payments and what does the agreement say about service suspension?");

  // Routed to structured/maintenance only — NOT to the unrelated Carter documents.
  await expect(page.getByTestId("source-structured")).toBeVisible();

  const answer = page.getByTestId("answer");
  // Honest refusal naming the missing field + the real columns.
  await expect(answer).toContainText(/no (payment|paid|due|status).*field|no payment-status|can'?t determine|cannot determine/i);
  await expect(answer).toContainText(/Completion Date/i); // the real schema columns cited
  // The pivot to real, doable analysis.
  await expect(answer).toContainText(/40,597/);
  // NEVER a fabricated overdue list.
  await expect(answer).not.toContainText(FABRICATED_OVERDUE);
  await expect(answer).not.toContainText(/child support|custody/i); // and no Carter leak
  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});

test("F-B: spend question → $40,597 total, 2026 $13,485.66/248, top vendor cited", async ({ page }) => {
  await ask(page, "How much did we spend on maintenance in 2026, and which vendors cost the most overall?");

  await expect(page.getByTestId("source-structured")).toBeVisible();
  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/13,485\.66/);
  await expect(answer).toContainText(/40,597/);
  await expect(answer).toContainText(/Oyoba/);
  await expect(answer).toContainText(/\[S:maintenance#\d+\]/); // drillable row citation
  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});

test("F-C: overdue question in Hebrew → same honest refusal, $40,597, no fabrication", async ({
  page,
}) => {
  await ask(page, "אילו לקוחות מאחרים בתשלומים ומה אומר ההסכם על השעיית שירות?");

  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/40,597/);
  await expect(answer).not.toContainText(FABRICATED_OVERDUE);
  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});
