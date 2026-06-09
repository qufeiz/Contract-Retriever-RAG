#!/usr/bin/env node
// doc-lint — the doc immune system (zero-dependency).
// Fails CI on: (1) broken relative links, (2) dead config/spec references,
// (3) undocumented journey specs, (4) the screenshot/gate ledger.
// The engine is generic; the project taxonomy lives in doc-lint.config.mjs.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, normalize, relative } from "node:path";
import config from "./doc-lint.config.mjs";

const ROOT = process.cwd();
const bad = [];
const rel = (f) => relative(ROOT, f).replaceAll("\\", "/");

function walk(d, acc = []) {
  let entries;
  try { entries = readdirSync(d); } catch { return acc; }
  for (const n of entries) {
    const p = join(d, n);
    const r = rel(p);
    if (config.excludeDirs.some((x) => r === x || r.startsWith(x + "/"))) continue;
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (n.endsWith(".md")) acc.push(p);
  }
  return acc;
}

function activeMarkdown() {
  const files = [];
  for (const f of config.activeTopLevelDocs) {
    const p = join(ROOT, f);
    if (existsSync(p)) files.push(p);
  }
  for (const d of config.activeDirs) {
    const p = join(ROOT, d);
    if (existsSync(p)) walk(p, files);
  }
  return files;
}

// ── Check 1+2: broken relative links & dead references ──────────────────────
const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
for (const f of activeMarkdown()) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(LINK)) {
      const raw = m[1].trim();
      const target = raw.split("#")[0].split("?")[0];
      if (/^(https?:|#|mailto:|tel:|data:)/.test(raw) || !target) continue;
      if (!existsSync(normalize(join(dirname(f), target)))) {
        bad.push(`${rel(f)}:${i + 1}  broken link → ${raw}`);
      }
    }
  });
}

// ── Check 3: journey-spec coverage (every spec documented, and vice-versa) ──
const specDir = join(ROOT, config.journeySpecDir);
const testingDocPath = join(ROOT, config.testingDoc);
if (existsSync(specDir) && existsSync(testingDocPath)) {
  const specs = readdirSync(specDir).filter((n) => n.endsWith(".spec.ts"));
  const doc = readFileSync(testingDocPath, "utf8");
  for (const s of specs) {
    if (!doc.includes(s)) {
      bad.push(`${config.testingDoc}  undocumented journey spec → ${s} (add it to the testing doc)`);
    }
  }
  // reverse: a *.spec.ts named in the doc that no longer exists on disk
  for (const m of doc.matchAll(/([\w./-]+\.spec\.ts)/g)) {
    const name = m[1].split("/").pop();
    if (!specs.includes(name)) {
      bad.push(`${config.testingDoc}  references a journey spec that does not exist → ${m[1]}`);
    }
  }
}

// ── Check 4: screenshot / gate ledger ───────────────────────────────────────
if (config.requireFeatureLedger) {
  const featuresDir = join(ROOT, config.featuresDir);
  if (existsSync(featuresDir)) {
    for (const feat of readdirSync(featuresDir)) {
      if (config.ledgerExemptFeatures.includes(feat)) continue;
      const featDir = join(featuresDir, feat);
      if (!statSync(featDir).isDirectory()) continue;
      const readmePath = join(featDir, "README.md");
      if (!existsSync(readmePath)) {
        bad.push(`${config.featuresDir}/${feat}  missing README.md ledger`);
        continue;
      }
      const ledger = readFileSync(readmePath, "utf8");
      const imagesDir = join(featDir, "images");
      if (existsSync(imagesDir)) {
        for (const img of readdirSync(imagesDir).filter((n) => n.endsWith(".png"))) {
          if (!ledger.includes(img)) {
            bad.push(`${config.featuresDir}/${feat}/README.md  screenshot not in ledger → images/${img}`);
          }
        }
      }
    }
  }
}

if (bad.length) {
  console.error("✗ doc-lint:\n" + bad.map((b) => "  " + b).join("\n"));
  process.exit(1);
}
console.log("✓ doc-lint: links, references, journey-spec coverage, and ledger OK");
