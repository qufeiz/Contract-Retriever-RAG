# Gotchas — sealed postmortems

This is the **append-driven** home for footguns: a trap that cost real time, written up so the next agent doesn't pay for it twice. **Lead with the lesson, not the narrative.** At bootstrap this folder has no gotcha files yet — that's correct; the first real miss creates the first one.

## The "seal" convention (read before writing one)

A fix is documented as *solved* only when it is **tested AND user-confirmed**. Every gotcha file opens with a **Confirmation status** line:

```markdown
> **Confirmation status: SEALED (YYYY-MM-DD).** <what's verified> — tested via <regression test>
> AND <who> confirmed on <what environment>. Root cause closed.
> (If not sealed: list what's verified vs. open, and "re-open if X recurs".)
```

- **A wrong "it's fixed" doc is worse than none** — the next agent trusts it. If you can't seal it yet, write it *not sealed* (verified vs. open).
- **Seal-decay:** a seal certifies correctness *at write time, not forever*. Treat an old gotcha as a hypothesis — if it names a file/flag/behavior, confirm that still exists before relying on it; if the bug recurs, flip the status back and re-open.
- **Link the gotcha ⇄ the enforcement both ways.** The gotcha names where it's now caught (a CI lint, a unit test, a self-check); the check points back to the why (this file). A gotcha with no enforcement link is a flag: should the lesson be *enforced*, not just remembered?

## Index
| Gotcha | Lesson |
|---|---|
| [sqlite-on-serverless.md](sqlite-on-serverless.md) | A bundled `*.sqlite` won't open via `better-sqlite3` on Vercel serverless even though `readFileSync` reaches it — copy the bytes to `/tmp` and open from there; build the DB with `journal_mode=DELETE`. |
| [committed-debug-stub-broke-prod.md](committed-debug-stub-broke-prod.md) | A removable-handler probe (`FORCED:` always-fail) got committed + deployed and forced every answer to "Rejected". Never commit a probe; verify the journey suite GREEN against the FRESH prod URL, not a stale `.next`. Now blocked by a `doc-lint` forbidden-marker scan. |
