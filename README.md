# AI Business Knowledge Assistant

A free-form business question is **routed** to the relevant source(s), answered by **hybrid SQL + RAG retrieval**, and returned as a **grounded answer with inline citations** you can trace to a SQLite row or a PDF page.

> This is **not** "upload PDFs into a vector DB and do semantic search" (the client rejected that). The differentiators are **query routing**, **hybrid retrieval (RAG + SQL)**, **grounded generation**, and **source attribution**, on an **extensible** architecture.

- **Live demo:** _(filled in on deploy)_
- **Architecture + diagram:** [docs/architecture.md](docs/architecture.md)
- **Engine internals:** [docs/features/shared-engine/reference.md](docs/features/shared-engine/reference.md)

## How it works (30 seconds)

```
question → ROUTER (DeepSeek, reports its choice) → SQL retrieval ⊕ RAG retrieval
        → grounded generation (cite every claim) → validateAnswer() → cited answer + source panel
```

The router is a real LLM decision over heterogeneous sources, reported in the UI. The structured store (CSV→SQLite) and the document store (PDF→vector index) share **no join key** — multi-source answers are **composed and cited separately**, never merged on an invented join. A pure `validateAnswer()` gate rejects any answer whose citation doesn't resolve to retrieved evidence.

## Stack
- **Next.js** (App Router) — self-contained, Vercel-deployable.
- **DeepSeek** (`deepseek-chat`, OpenAI-compatible) — routing + grounded generation (key env-only).
- **Local** `Xenova/multilingual-e5-small` embeddings (no key; the Hebrew-readiness seam).
- **Bundled read-only SQLite** + an **in-app vector index** — both rebuilt deterministically from `data/` by `npm run build:index`.

## Run locally
```bash
npm install
cp .env.example .env.local        # fill in the real DeepSeek values
npm run build:index               # build data-index/ from data/*.csv + the PDFs
npm run dev                       # http://localhost:3000
```
Details + deploy: [docs/ops/environment.md](docs/ops/environment.md).

## Quality gates (the immune system)
| Gate | Run | Proves |
|---|---|---|
| `doc-lint` | `npm run doc-lint` | No broken doc links/refs; journey-spec coverage; the screenshot/gate ledger. |
| `doc-structure-lint` | `npm run doc-structure-lint` | Every `user-guide.md` follows the how-to skeleton. |
| Unit | `npm run test` | `validateAnswer()` content-fidelity (passes goldens, fails toys); the CSV loader's graceful malformed handling; the router-plan contract. |
| Journey | `npm run test:journeys` | The full pipeline against the running app — routed source, resolvable citations, real evidence, `validateAnswer` pass. Removable-handler-proof. |

All four run in CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Repo map
- `lib/engine/` — the shared retrieval engine (loader, embeddings, router, retrieval, grounding, `validateAnswer`).
- `app/` — the Next.js UI + `/api/ask`.
- `scripts/` — `build-index.mts` (data → bundled index) + the doc lints.
- `docs/` — architecture, the shared-engine reference, per-feature folders, gotchas, log, the doc/test playbook.
- `data/` — the source CSVs + PDFs (committed).

Start in [docs/README.md](docs/README.md) · landmines + conventions in [CLAUDE.md](CLAUDE.md).
