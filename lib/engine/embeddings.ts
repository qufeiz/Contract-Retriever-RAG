// Local multilingual embeddings via transformers.js (Xenova/multilingual-e5-small).
// No API key — runs locally at build time (to embed PDF chunks) and at query time
// (to embed the question). Multilingual → the Hebrew-readiness seam.
//
// e5 models expect "query: " / "passage: " prefixes; we apply them so EN and HE
// land in the same space.
let _extractor: any = null;

async function getExtractor() {
  if (_extractor) return _extractor;
  const { pipeline } = await import("@xenova/transformers");
  _extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small");
  return _extractor;
}

async function embed(text: string, prefix: "query" | "passage"): Promise<number[]> {
  const extractor = await getExtractor();
  const out = await extractor(`${prefix}: ${text}`, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

export const embedQuery = (t: string) => embed(t, "query");
export const embedPassage = (t: string) => embed(t, "passage");

export function cosineSim(a: number[], b: number[]): number {
  // vectors are L2-normalized → dot product is cosine similarity
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
