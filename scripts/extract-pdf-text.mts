// Build-machine-only: extract PDF text per page using pdftotext (poppler) and
// commit it to data/pdf-pages.json, so the Vercel build (no poppler) can build the
// vector index without pdftotext. Run this whenever the source PDFs change.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractPages } from "../lib/engine/pdf.ts";
import { DOCUMENTS } from "../lib/engine/documents.ts";

const DATA = join(process.cwd(), "data");
const out: Record<string, string[]> = {};
for (const d of DOCUMENTS) {
  out[d.doc] = extractPages(join(DATA, d.file));
  console.log(`  ${d.doc}: ${out[d.doc].length} pages extracted`);
}
writeFileSync(join(DATA, "pdf-pages.json"), JSON.stringify(out, null, 2));
console.log("wrote data/pdf-pages.json");
