# Docs index

The load-on-demand home for everything that doesn't belong in the always-loaded `../CLAUDE.md`. Start with `architecture.md` to understand the system, then read the area your task touches.

## Index
| Doc | What it is |
|---|---|
| [architecture.md](architecture.md) | The shape of the system: stack → data flow → routing → retrieval → grounding/citation → data model → Hebrew seam → honest rough edges. **Start here.** |
| [log.md](log.md) | Append-only decisions & incidents, newest first. The "why is it like this" trail. |
| [ops/environment.md](ops/environment.md) | Env vars, secrets hygiene, local run, deploy. |
| [testing/README.md](testing/README.md) | What test suites exist, how to run them, the journey-test discipline. |
| [gotchas/README.md](gotchas/README.md) | Sealed postmortems (footguns). Teaches the "seal" convention. |
| [features/shared-engine/reference.md](features/shared-engine/reference.md) | The shared retrieval engine internals — loader, embed, router, retrieval, citation, `validateAnswer()`. |
| [meta/ai-native-docs-playbook.md](meta/ai-native-docs-playbook.md) | The portable doc/test methodology this repo is built on. |

## Feature docs
Each domain capability is its own feature folder under `features/`, built on the shared engine. Each owns its `04-implementation.md`, `user-guide.md`, and a screenshot/gate `README.md` ledger.

| Feature | Folder |
|---|---|
| Shared engine (infrastructure, documented once) | [features/shared-engine/](features/shared-engine/) |
| _Per-feature folders are added as each feature ships (contract-intelligence, receivables-intelligence, case-file-qa, …)._ | |

## Maintaining these docs

**The anti-drift rule:** every active doc must stay true to the code in the *same change* that alters the code. `doc-lint` catches broken links and dead references; it cannot catch a stale *description* — that's on you.

### Which doc to update when
| When you change… | Update… |
|---|---|
| Any incident / decision / non-obvious fix | `log.md` — always |
| System structure / data flow / the routing or retrieval design | `architecture.md` |
| The shared engine internals (loader, router, citation, validation) | `features/shared-engine/reference.md` |
| What a feature *does* | that feature's folder + run the feature-design process |
| An env var | `ops/environment.md` (+ `.env.example`) |
| A sealed footgun | a `gotchas/` file (+ a `log.md` one-liner) |
| A new user-facing capability | that feature's `user-guide.md` + a golden screenshot + the `README.md` ledger row |

### Doc types (Diátaxis)
Every page is one of: **how-to** (`features/*/user-guide.md` — numbered, action-first steps), **reference** (facts/internals — `features/shared-engine/reference.md`), **explanation** (`architecture.md`). The per-page contract and the how-to skeleton are enforced by `../scripts/doc-structure-lint.mjs`.
