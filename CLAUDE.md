# Contract-Retriever-RAG — agent guide

Auto-loaded every session. Map + landmines. Detail lives in `docs/` — read `docs/README.md` and `docs/log.md` first.

This is an **AI Business Knowledge Assistant**: a free-form question is **routed** to the relevant source(s), answered by **hybrid SQL + RAG retrieval**, and returned as a **grounded answer with inline citations**. It is **NOT** a "upload PDFs + semantic search" chatbot — the client explicitly rejected that.

## 🚨 Landmines — do not get these wrong
1. **Never commit secrets.** The LLM key lives only in `.env.local` (gitignored) and as a Vercel env var. `.gitignore` excludes all `.env*` except `.env.example`. Commit `.env.example` (names + placeholders only). → `docs/ops/environment.md`
2. **No faked or hardcoded answers.** Every answer is produced by REAL routing + REAL retrieval. A factual claim with no resolvable citation (SQLite row id / PDF page) must be **rejected by `validateAnswer()`**, not shipped. → `docs/architecture.md`
3. **The structured (CSV→SQLite) and PDF domains share NO join key.** Never fabricate a join between a school-vendor contract row and the Carter family-court PDF. Multi-source answers are **composed and cited separately**, never merged on an invented key. → `docs/architecture.md`
4. **Some CSV rows are malformed** (`error: undefined method ...`). The loader must ingest them **gracefully** (quarantine/flag, never crash). → `docs/features/shared-engine/reference.md`
5. **The bundled index is a generated artifact.** `npm run build:index` rebuilds `data-index/` deterministically from `data/`. Don't hand-edit it; don't commit it (gitignored).

## Where things are
| Need | Doc |
|---|---|
| Understand the system (routing, retrieval, grounding) | `docs/architecture.md` |
| The shared engine internals (loader, embed, router, citation, validateAnswer) | `docs/features/shared-engine/reference.md` |
| Run it locally · env vars | `README.md` · `docs/ops/environment.md` |
| Tests / journey suite | `docs/testing/README.md` |
| Decisions & incidents | `docs/log.md` |
| Footguns (sealed) | `docs/gotchas/README.md` |
| The doc/test methodology | `docs/meta/ai-native-docs-playbook.md` |

## Working conventions
- When something non-obvious happens → add a `docs/log.md` entry + update the relevant doc, **same change**.
- Keep active docs true to the code. Which doc? → the "Which doc to update when" table in `docs/README.md`.
- **A passing test must mean the user can actually use the feature** — assert what the user SEES (the routed, cited answer), not just that a handler fired. → `docs/testing/README.md`
- **Every factual claim in an answer must cite a resolvable source** (a SQLite row id or a PDF page). If a source has no answer, say so honestly — never fabricate. This is enforced by `validateAnswer()` + its unit test.
- English-first; the architecture is Hebrew-ready (multilingual local embeddings + a normalization seam). → `docs/architecture.md`
