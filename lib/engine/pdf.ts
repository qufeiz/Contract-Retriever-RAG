// PDF → per-page text → chunks. Uses pdftotext (poppler) at BUILD time only, so
// no PDF-parsing dependency ships to the serverless runtime — the vector index is
// prebuilt JSON. Each chunk keeps its source doc + page number (the [P:doc#page]
// citation anchor).
import { execFileSync } from "node:child_process";

export type PdfChunk = { doc: string; page: number; text: string };

/** Extract text per page using pdftotext's form-feed page separators. */
export function extractPages(pdfPath: string): string[] {
  const out = execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  // pdftotext separates pages with the form-feed character (\f).
  return out.split("\f").map((p) => p.replace(/​/g, "").trim());
}

/** Chunk a page into ~chunkChars windows on sentence/line boundaries. */
function chunkPage(text: string, chunkChars = 900, overlap = 150): string[] {
  if (text.length <= chunkChars) return text.length ? [text] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkChars, text.length);
    if (end < text.length) {
      const lastBreak = text.lastIndexOf("\n", end);
      if (lastBreak > start + chunkChars / 2) end = lastBreak;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

/** Turn a PDF into citable chunks (doc + page + text). */
export function pdfToChunks(pdfPath: string, doc: string): PdfChunk[] {
  const pages = extractPages(pdfPath);
  const chunks: PdfChunk[] = [];
  pages.forEach((pageText, idx) => {
    const page = idx + 1;
    for (const text of chunkPage(pageText)) chunks.push({ doc, page, text });
  });
  return chunks;
}
