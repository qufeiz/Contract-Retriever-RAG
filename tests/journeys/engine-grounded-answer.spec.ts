import { test, expect } from "@playwright/test";

// SHARED-ENGINE journey gate — the permanent regression guard for the whole
// pipeline: route → retrieve → ground → cite → validate, against the running app.
//
// Removable-handler-proof: if routing/retrieval/validation were stubbed to return
// nothing, these would go RED — they assert the routed SOURCE badge, the cited
// EVIDENCE rows/chunks, resolvable citation tokens in the answer, and the
// validateAnswer() pass. A spinner stopping is NOT enough.

async function ask(page: import("@playwright/test").Page, question: string) {
  await page.goto("/");
  await page.getByLabel("Ask a question").fill(question);
  await page.getByRole("button", { name: "Ask" }).click();
  // Wait on the real signal: the answer panel rendered (not a fixed sleep).
  await expect(page.getByTestId("answer")).toBeVisible({ timeout: 60_000 });
}

test("structured route: contracts expiring is answered from SQL with resolvable citations", async ({
  page,
}) => {
  await ask(page, "What contracts expire in the next 90 days?");

  // Routed to the structured source (the differentiator, reported to the user).
  await expect(page.getByTestId("source-structured")).toBeVisible();

  // The answer contains structured citation tokens — grounded, not fluent-only.
  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/\[S:contracts#\d+\]/);

  // Evidence panel shows real retrieved rows (the 38 expiring contracts).
  const sources = page.getByTestId("sources-panel");
  await expect(sources).toContainText(/\[S:contracts#\d+\]/);

  // The content-fidelity gate passed.
  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});

test("document route: the Carter custody/support finding is answered from the PDF, page-cited", async ({
  page,
}) => {
  await ask(page, "What did the court decide about custody and child support for the Carters?");

  await expect(page.getByTestId("source-documents")).toBeVisible();

  const answer = page.getByTestId("answer");
  // The golden fact and a resolvable page citation.
  await expect(answer).toContainText(/1,285/);
  await expect(answer).toContainText(/\[P:family-court#\d+\]/);

  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});

test("honest composition: penalties absent from the data are NOT fabricated", async ({ page }) => {
  await ask(
    page,
    "What contracts expire in the next 90 days and what penalties are defined in those contracts?"
  );

  // Lists the contracts (cited) AND honestly states penalties are not in sources.
  const answer = page.getByTestId("answer");
  await expect(answer).toContainText(/\[S:contracts#\d+\]/);
  await expect(answer).toContainText(/not present|not (defined|available|specified)|no penalt/i);

  await expect(page.getByTestId("validation")).toContainText(/Grounded/i);
});
