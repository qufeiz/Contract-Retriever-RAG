// doc-lint config — the PROJECT MAP (which dirs are active, what's exempt and WHY).
// The engine (doc-lint.mjs) stays generic; the taxonomy lives here.
// Every exemption MUST carry its rationale — an exemption with no rationale is how rot hides.

export default {
  // Active markdown roots: linted for broken links + dead references.
  // A frozen archive (none yet) would be excluded here.
  activeTopLevelDocs: ["CLAUDE.md", "README.md"],
  activeDirs: ["docs"],

  // Dirs never linked-checked (frozen history / generated). None yet.
  excludeDirs: [".git", "node_modules", ".next", "dist", "data-index", "docs/archive"],

  // ── Journey-spec coverage ───────────────────────────────────────────────
  // Every *.spec.ts under this dir must be documented in the testing doc, and
  // vice-versa, so a new journey can't ship undocumented.
  journeySpecDir: "tests/journeys",
  testingDoc: "docs/testing/README.md",

  // ── Screenshot / gate ledger ────────────────────────────────────────────
  // Each feature folder's README.md is a ledger. doc-lint fails the build if a
  // shipped screenshot (images/*.png) isn't in the ledger, or a feature gate
  // (a *<feature>*.spec.ts) isn't listed.
  // requireFeatureLedger stays FALSE until the first feature folder exists
  // (bootstrap §A Step 5: don't arm a ledger lint with no ledger to point at).
  // The shared-engine folder is INFRASTRUCTURE, not a user-facing feature with a
  // capability/screenshot ledger — it is exempt from the ledger requirement.
  requireFeatureLedger: false,
  featuresDir: "docs/features",
  ledgerExemptFeatures: ["shared-engine"], // infrastructure ref doc, not a capability ledger
};
