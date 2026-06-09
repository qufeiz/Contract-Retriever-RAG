# Project log — decisions & incidents

Append-only. **Newest first.** Format: `## [YYYY-MM-DD] type | title`, then a few lines + links.
Types: incident · decision · feat · fix · reorg.
> When something non-obvious happens, add an entry here and update the relevant doc in the same change.

---

## [2026-06-09] incident | Bundled SQLite returned 0 rows on first Vercel deploy
First prod deploy: every structured query returned empty (RAG/PDF path worked); `validateAnswer()` correctly rejected the ungrounded result. Cause: `better-sqlite3` can't open the traced bundled `.sqlite` on Lambda. Fix: copy bytes to `/tmp` and open from there + build with `journal_mode=DELETE`. Also pinned `ASSISTANT_TODAY=2026-06-09` for a deterministic demo. Sealed: `gotchas/sqlite-on-serverless.md`. META-MISS: tests were green on localhost — the journey suite now also runs against the live URL.

## [2026-06-09] decision | Design-approval gate convention recorded
The user approved the design + golden bar for this build (an AI Business Knowledge Assistant: routed, hybrid SQL+RAG, grounded+cited answers). **Convention for this repo:** no code/migration/test ships before a *written* design is *explicitly* approved — a prior "do it" on one feature never carries to the next. The PM owns the design + the golden bar; an independent Verifier grades; the Engineer never self-certifies.

## [2026-06-09] decision | Honest multi-source composition; no fabricated joins
The structured CSVs (→ SQLite) and the PDFs (Carter family-court case) share **no join key** — school vendors are unrelated to the Carter family case. Multi-source answers are **composed and cited separately**, never merged on an invented key. Also recorded: the contracts CSV (`school data 1.csv`) has **no penalty/terms column** and there are no vendor-contract PDFs, so "what penalties are defined in those contracts" must be answered honestly ("penalties are not present in the available sources") rather than fabricated. → `architecture.md`

## [2026-06-09] decision | LLM = DeepSeek; embeddings = LOCAL multilingual
DeepSeek (`deepseek-chat`, OpenAI-compatible) is the LLM (router + generation); the key is env-only, never committed. Embeddings are a **local** multilingual model (`Xenova/multilingual-e5-small`) computed at build time — no embeddings key, and it gives the Hebrew-readiness seam. Self-contained: a bundled read-only SQLite (CSVs) + an in-app vector index (PDF chunks). → `architecture.md`, `ops/environment.md`

## [2026-06-09] feat | Bootstrap — doc skeleton + immune system + CI
Greenfield repo stood up per the feature-system §A sequence: doc skeleton (CLAUDE.md, docs/README.md, this log, gotchas, architecture, meta playbook), the `doc-lint` + `doc-structure-lint` immune system wired as **required** CI steps, starter memory, and this approval-gate convention. The shared engine is the first worked example.
