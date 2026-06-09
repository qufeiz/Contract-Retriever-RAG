# Architecture — AI Business Knowledge Assistant

Start here to understand the system. This is the **explanation** doc (why it's shaped this way); the operational internals live in [features/shared-engine/reference.md](features/shared-engine/reference.md).

## What it is (and is not)

A free-form business question is **routed** to the relevant source(s), answered by **hybrid retrieval** (SQL over structured data + RAG over documents), and returned as a **grounded answer with inline citations**. Every factual claim traces back to a resolvable source — a SQLite row id or a PDF page.

It is **NOT** "upload PDFs into a vector DB and do semantic search." The client rejected that explicitly. The differentiators are **query routing**, **hybrid SQL+RAG retrieval**, **grounded generation**, and **source attribution** — with an **extensible** architecture (future CRM / email / cloud-storage / case-management connectors plug in as new sources behind the same router).

## Stack

| Layer | Choice | Why |
|---|---|---|
| App / UI | **Next.js** (App Router) — ask box → routed, cited answer | Self-contained, deployable to Vercel as one unit |
| LLM | **DeepSeek** (`deepseek-chat`, OpenAI-compatible, `https://api.deepseek.com`) | Router decision + grounded generation. Key is env-only. |
| Embeddings | **Local** `Xenova/multilingual-e5-small` (transformers.js) | No embeddings key; multilingual → the **Hebrew seam**; computed at build time |
| Structured store | **Bundled read-only SQLite** (`better-sqlite3`), built from `data/*.csv` | The SQL half of hybrid retrieval; deterministic, self-contained |
| Document store | **In-app vector index** (PDF chunks + local embeddings, JSON) | The RAG half; no external vector DB |

## Data flow

```
                                  ┌────────────────────────────────────────────┐
   NL question  ─────────────────▶│  ROUTER  (DeepSeek, structured JSON out)    │
   (EN / HE)                      │  decides sources + REPORTS which it picked   │
                                  └───────────────┬──────────────┬──────────────┘
                                                  │              │
                              ┌───────────────────┘              └───────────────────┐
                              ▼                                                       ▼
                  ┌───────────────────────┐                          ┌───────────────────────────┐
                  │  SQL RETRIEVAL        │                          │  RAG RETRIEVAL            │
                  │  read-only SQLite     │                          │  vector search over PDF    │
                  │  (contracts, invoices,│                          │  chunks (local embeddings) │
                  │   payroll, enrollment)│                          │  → top-k chunks + page #   │
                  │  → rows + row ids     │                          │                            │
                  └───────────┬───────────┘                          └─────────────┬─────────────┘
                              │            evidence (rows w/ ids  +  chunks w/ pages)              │
                              └───────────────────────────┬──────────────────────────────────────┘
                                                          ▼
                                  ┌────────────────────────────────────────────┐
                                  │  GROUNDED GENERATION  (DeepSeek)            │
                                  │  answer ONLY from evidence, each claim      │
                                  │  carries an inline citation [S:rowid]/[P:pg]│
                                  └───────────────────────┬────────────────────┘
                                                          ▼
                                  ┌────────────────────────────────────────────┐
                                  │  validateAnswer()  — pure content-fidelity  │
                                  │  every claim's citation resolves to real    │
                                  │  evidence; reject uncited / fabricated      │
                                  └───────────────────────┬────────────────────┘
                                                          ▼
                          routed, cited answer  +  the source panel (which sources, which rows/pages)
```

The full request loop, the exact router contract, the citation token format, and the `validateAnswer()` rules are in [features/shared-engine/reference.md](features/shared-engine/reference.md).

## Routing — the differentiator, done for real

The router is a **real DeepSeek call** that returns structured JSON naming the source(s) it selected and a one-line rationale — and the UI **reports that decision** (it is not a hidden heuristic). A question like *"What contracts expire in the next 90 days?"* routes to **structured/SQL**; *"What did the court decide about custody?"* routes to **documents/RAG**; a question spanning both composes from both. The router degrades safely: if it can't confidently pick, it queries the candidate sources and lets retrieval relevance decide, rather than guessing.

## Hybrid retrieval

- **SQL side** — typed queries against the bundled SQLite. Each returned row carries its stable **row id**, which becomes the citation `[S:<table>#<id>]`.
- **RAG side** — the question is embedded with the same local multilingual model used at build time; cosine similarity selects top-k PDF chunks, each carrying its **page number**, which becomes the citation `[P:<doc>#<page>]`.
- **Composition** — when both fire, evidence is concatenated and the two citation namespaces stay **separate**. There is no join between them (see below).

## Grounded generation + citation

Generation is instructed to answer **only** from the supplied evidence and to attach an inline citation to **every** factual claim. The output is then passed through `validateAnswer()` — a pure function — which checks that every citation token resolves to a real piece of evidence in this turn and rejects an answer that makes an uncited factual claim. This is the gate that turns "fluent but ungrounded" (the toy failure) into a red result instead of a shipped lie.

## Data model (bundled SQLite, from `data/*.csv`)

| Source CSV | Table | Domain | Notes |
|---|---|---|---|
| `school data 1.csv` | `contracts` | Vendor contracts (Contract ID, Vendor, Start/End Date, Annual Cost) | **No penalty/terms column** — see rough edges |
| `school data 3.csv` | `maintenance_invoices` | Maintenance tickets / invoices (labor, parts, total, completion date) | |
| `school data 5.csv` | `invoice_volume` | Invoice volume per student | |
| `school data 4.csv` | `payroll_v1` | Payroll (gross/net, deductions) | ~235 malformed rows (`error: undefined ...`) — quarantined |
| `school data 6.csv` | `payroll_v2` | Payroll (alt schema) | |
| `school data 2.csv` | `enrollment` | Course enrollment | `term_name` column is entirely malformed — quarantined per-cell |
| `school data .csv` | `people` | Directory (names, emails) | |

Each row gets a stable integer `id` (the citation anchor). Malformed cells are loaded with a `__malformed` flag rather than crashing the loader.

PDF documents (the RAG side, not in SQLite):
- **Family Court Case File (Carter)** — 7 pages: custody, financial disclosure, court findings, final judgment (joint custody; **child support $1,285/month**).
- **The Carter Family Story** — 3 pages: narrative backstory leading to the divorce.

## Multi-tenancy / extensibility

MVP is single-tenant and self-contained. The router + retrieval layer is **source-pluggable**: a future CRM, email, cloud-storage, or case-management connector registers as a new retrieval source behind the same router contract, without changing the grounding/citation layer. This is the "extensible architecture" the client asked for.

## The Hebrew seam (EN-first, architecturally ready)

The embedding model is multilingual, so a Hebrew document chunk and a Hebrew question land in the same vector space as English today. What's deferred for the MVP: RTL UI polish, Hebrew-tuned generation prompts, and Hebrew test fixtures. The seam (a normalization + language-detect point on the question before routing) exists so adding Hebrew is a content task, not a re-architecture.

## Honest rough edges (decisions & deferrals)

- **No join between structured and document domains.** School vendors and the Carter family case are unrelated; the system **never fabricates a join**. Cross-source questions are *composed*, with each fact cited to its own source.
- **Penalties / contract terms are not in the data.** The contracts CSV has cost + dates only — no penalty clause column, and there are no vendor-contract PDFs. The example question "what penalties are defined in those contracts" is answered honestly: the expiring contracts are listed and cited, and the system states that penalty terms are **not present in the available sources**. This is the grounding discipline working as designed, not a gap to paper over.
- **Malformed CSV rows** are quarantined, not dropped silently — counts are surfaced so the data quality is visible rather than hidden.
- **Two payroll schemas** (`school data 4.csv` and `6.csv`) describe overlapping but non-identical payroll data; they are kept as separate tables rather than force-merged.
