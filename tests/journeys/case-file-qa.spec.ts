import { test, expect } from "@playwright/test";

// case-file-qa feature gate (permanent regression guard).
// Derived from docs/features/case-file-qa/03-tests.md Part 5.
// Removable-handler-proof: stub retrieval/compose → these go red.

async function ask(page: import("@playwright/test").Page, q: string) {
  await page.goto("/");
  await page.getByLabel("Ask a question").fill(q);
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("answer")).toBeVisible({ timeout: 60_000 });
}

test("F-A: Final Judgment (EN) → $1,285 + Joni Carter primary residence, Page-24 cited", async ({
  page,
}) => {
  await ask(page, "What was the final child support amount, and who got primary residence in the Carter case?");

  await expect(page.getByTestId("source-documents")).toBeVisible();
  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/1,285/);
  await expect(answer).toContainText(/Joni Carter/i);
  // Cited to the court file's printed Page 24 (the Final Judgment).
  await expect(answer).toContainText(/\[P:family-court#24\]/);
  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});

test("F-B: grounds question → corroborated across BOTH documents (two distinct cites)", async ({
  page,
}) => {
  await ask(page, "What were the grounds for the Carters' divorce?");

  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/\[P:family-court#\d+\]/);
  await expect(answer).toContainText(/\[P:carter-story#\d+\]/); // the second document
  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});

test("F-C: filing-date question → surfaces BOTH Feb 10 and Feb 3 as a conflict", async ({ page }) => {
  await ask(page, "When did Joni Carter file for divorce?");

  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/(10 February|February 10)/i);
  await expect(answer).toContainText(/February 3/i);
  await expect(answer).toContainText(/conflict|disagree|differ/i);
  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});

test("F-D: Final Judgment in Hebrew → same $1,285 + Page-24 citation", async ({ page }) => {
  await ask(page, "מה היה סכום המזונות הסופי ולמי ניתנה המשמורת העיקרית בתיק קרטר?");

  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/1,285/);
  await expect(answer).toContainText(/\[P:family-court#24\]/);
  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});
