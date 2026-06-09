# Testing

The test discipline for this repo. The core rule: **a passing test must mean the user can actually use the feature** — assert what the user SEES (a routed, cited answer), not just that a handler fired.

## Suites

| Suite | What it proves | Run |
|---|---|---|
| **Unit** (`tests/unit/*.test.mts`) | Pure logic, **test-first**. The headline gate is `validateAnswer()` content-fidelity: it must **pass every golden answer and fail every toy** (a fluent-but-uncited answer, a citation that resolves to nothing). Also: the router contract parser, the CSV loader's graceful handling of malformed rows. | `npm run test` |
| **Journey** (`tests/journeys/*.spec.ts`) | End-to-end against the **running app** (post-deploy): ask a golden question → the answer renders with the right routed source(s) and **resolvable citations** the golden expects. Committed as a **permanent regression gate**, never a one-off. Removable-handler-proof: if retrieval were stubbed to return nothing, the test must go red. | `npm run test:journeys` |

**Run the journey suite against the LIVE deploy, not just localhost.** Set `JOURNEY_BASE_URL=https://contract-retriever-rag.vercel.app` so the **prod serverless function** is asserted (the structured route uses a bundled SQLite that behaves differently on Lambda — a green-on-localhost / broken-in-prod miss already happened: `../gotchas/sqlite-on-serverless.md`). The final pass runs both localhost and the deployed URL.

## Journey-test discipline (non-negotiable)
- **Assert the visible outcome**, not feedback. "The answer text contains the 38 expiring contracts and each cites a `[S:contracts#id]`" — not "a response div appeared".
- **Feedback ≠ outcome.** A spinner stopping or a box filling proves the request fired, not that the answer is grounded. Assert the citation tokens resolve and the claimed facts are present.
- **Removable-handler-proof.** If the core logic (routing/retrieval/validation) were removed or stubbed, the test must fail. A test that would still pass against an empty engine is invalid.
- **Wait on the real signal** (the answer response / a rendered citation), never a fixed `waitForTimeout`. A test that only passes on retry is a must-investigate race, not a shrug.
- **No graceful skips for missing preconditions.** Seed any required state with an `ensure*` helper.

## Journey specs (the ledger — keep in sync with disk)
| Spec | Proves |
|---|---|
| `engine-grounded-answer.spec.ts` | The shared-engine pipeline end-to-end: structured-route (contracts expiring → SQL, `[S:contracts#id]` citations), document-route (Carter custody/support → PDF, `[P:family-court#page]`, the $1,285 golden), and honest composition (penalties absent → not fabricated). Each asserts the routed source badge, resolvable citation tokens, real evidence rows, and the `validateAnswer()` "Grounded" pass — removable-handler-proof. |
| `contract-intelligence.spec.ts` | The contract-intelligence feature (pinned `asOfDate=2026-06-09`): F-A spec Q1 EN (38 count, $18,924,883.79 total, cited row, honest penalty, SQL-only, **no Carter leak**), F-B the same in Hebrew, F-C the single Skalith contract. Asserts the cross-domain-leak guard (J1) and the `validateContractAnswer()` "Grounded" pass. |

> doc-lint fails the build if a `tests/journeys/*.spec.ts` exists but isn't listed here, or vice-versa.
