/**
 * bm25.js — Competitor Battleground
 * Pure-JS BM25 keyword search implementation.
 * No external packages required.
 *
 * BM25 params (Okapi BM25 standard defaults):
 *   k1 = 1.5  (term frequency saturation)
 *   b  = 0.75 (length normalization)
 */

const K1 = 1.5;
const B  = 0.75;

/** Tokenize text into lowercase terms */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Build a BM25 index from an array of chunks.
 * @param {Array<{text: string}>} chunks
 * @returns {object} BM25 index object
 */
export function buildIndex(chunks) {
  const N   = chunks.length;
  const idf = new Map();     // term → IDF score
  const tf  = [];            // per-doc term frequencies
  const dl  = [];            // per-doc lengths (token count)

  // Calculate term frequencies per document
  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    dl.push(tokens.length);
    const freq = new Map();
    for (const t of tokens) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    tf.push(freq);
  }

  // Average document length
  const avgdl = dl.reduce((a, b) => a + b, 0) / (N || 1);

  // Build global DF (document frequency) for IDF calculation
  const df = new Map();
  for (const freq of tf) {
    for (const term of freq.keys()) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  // Compute IDF for each term: log((N - df + 0.5) / (df + 0.5) + 1)
  for (const [term, docFreq] of df.entries()) {
    idf.set(term, Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1));
  }

  return { N, tf, dl, idf, avgdl };
}

/**
 * Score a single chunk against a query using BM25.
 * @param {string[]} queryTerms
 * @param {number} docIdx
 * @param {object} index
 * @returns {number} BM25 score (raw, not normalized)
 */
function bm25Score(queryTerms, docIdx, index) {
  const { tf, dl, idf, avgdl } = index;
  const freq  = tf[docIdx];
  const docDl = dl[docIdx];

  let score = 0;
  for (const term of queryTerms) {
    const termIdf = idf.get(term) || 0;
    const termFreq = freq.get(term) || 0;
    const numerator   = termFreq * (K1 + 1);
    const denominator = termFreq + K1 * (1 - B + B * (docDl / avgdl));
    score += termIdf * (numerator / (denominator || 1));
  }
  return score;
}

/**
 * Search chunks using BM25, returning top-K with normalized scores [0,1].
 * @param {string} query
 * @param {Array<{text: string, source: string}>} chunks
 * @param {object} index  — from buildIndex()
 * @param {number} topK
 * @returns {Array<{text, source, chunkIdx, keywordScore}>}
 */
export function searchBM25(query, chunks, index, topK = 10) {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0 || chunks.length === 0) return [];

  const rawScores = chunks.map((_, i) => ({
    chunkIdx:   i,
    rawScore:   bm25Score(queryTerms, i, index),
  }));

  // Normalize scores to [0, 1]
  const maxRaw = Math.max(...rawScores.map(r => r.rawScore), 1e-9);

  const normalized = rawScores
    .map(r => ({
      chunkIdx:     r.chunkIdx,
      keywordScore: r.rawScore / maxRaw,
    }))
    .sort((a, b) => b.keywordScore - a.keywordScore)
    .slice(0, topK);

  return normalized.map(r => ({
    ...chunks[r.chunkIdx],
    chunkIdx:     r.chunkIdx,
    keywordScore: r.keywordScore,
  }));
}
