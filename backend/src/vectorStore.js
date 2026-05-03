/**
 * vectorStore.js — Competitor Battleground
 *
 * In-memory vector store with:
 *   - Cosine similarity (semantic search)
 *   - BM25 keyword index (keyword search)
 *   - Hybrid retrieval: score = 0.7 × semantic + 0.3 × keyword
 */

import { buildIndex, searchBM25 } from './bm25.js';

// ── Cosine Similarity ─────────────────────────────────────────────────────────

/** Cosine similarity between two equal-length vectors */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── In-memory store ───────────────────────────────────────────────────────────

/**
 * sessionId → {
 *   entries: Array<{ text, source, vector }>,
 *   bm25Index: object          ← BM25 index built from all chunks
 * }
 */
const sessions = new Map();

// ── Store ─────────────────────────────────────────────────────────────────────

/**
 * Store embedded chunks for a session and build a BM25 index.
 * @param {string} sessionId
 * @param {Array<{text: string, source: string, chunkIndex: number}>} chunks
 * @param {number[][]} vectors  — one embedding per chunk
 */
export function storeVectors(sessionId, chunks, vectors) {
  if (chunks.length !== vectors.length) {
    throw new Error('chunks and vectors arrays must have equal length');
  }

  const entries = chunks.map((chunk, i) => ({
    text:   chunk.text,
    source: chunk.source,
    vector: vectors[i],
  }));

  // Build BM25 index over all chunk texts
  const bm25Index = buildIndex(entries);

  sessions.set(sessionId, { entries, bm25Index });
  console.log(`[vectorStore] Stored ${entries.length} vectors + BM25 index for session ${sessionId}`);
}

// ── Hybrid Retrieval ──────────────────────────────────────────────────────────

/**
 * Hybrid retrieval: 0.7 × semantic + 0.3 × BM25.
 * Returns top-K chunks with full score breakdown.
 *
 * @param {string}   sessionId
 * @param {number[]} queryVector  — embedding of the query
 * @param {string}   queryText    — raw query text for BM25
 * @param {number}   k            — how many chunks to return
 * @returns {Array<{text, source, score, semanticScore, keywordScore}>}
 */
export function hybridRetrieve(sessionId, queryVector, queryText, k = 5) {
  const session = sessions.get(sessionId);
  if (!session || session.entries.length === 0) {
    throw new Error(`No vectors found for session ${sessionId}`);
  }

  const { entries, bm25Index } = session;

  // ── Semantic scores ─────────────────────────────────────────────────────────
  const semanticScores = entries.map((entry, idx) => ({
    idx,
    semanticScore: cosineSimilarity(queryVector, entry.vector),
  }));

  // Normalize semantic scores to [0, 1]
  const maxSem = Math.max(...semanticScores.map(s => s.semanticScore), 1e-9);
  for (const s of semanticScores) s.semanticScore /= maxSem;

  // ── BM25 keyword scores ─────────────────────────────────────────────────────
  const bm25Results = searchBM25(queryText, entries, bm25Index, entries.length);
  const keywordMap  = new Map(bm25Results.map(r => [r.chunkIdx, r.keywordScore]));

  // ── Hybrid fusion ──────────────────────────────────────────────────────────
  const fused = semanticScores.map(({ idx, semanticScore }) => {
    const keywordScore = keywordMap.get(idx) ?? 0;
    const score        = 0.7 * semanticScore + 0.3 * keywordScore;
    return {
      text:          entries[idx].text,
      source:        entries[idx].source,
      score,
      semanticScore,
      keywordScore,
    };
  });

  fused.sort((a, b) => b.score - a.score);
  const topK = fused.slice(0, k);

  console.log(
    `[vectorStore] Hybrid top-${topK.length} ` +
    `(scores: ${topK.map(c => c.score.toFixed(3)).join(', ')})`
  );
  return topK;
}

/**
 * Retrieve the top-K chunks using hybrid search.
 * Drop-in backward-compatible wrapper for old retrieveTopK calls.
 * Note: queryText defaults to empty string — use hybridRetrieve directly for best results.
 *
 * @param {string}   sessionId
 * @param {number[]} queryVector
 * @param {number}   k
 * @param {string}   queryText   — optional; pass for proper BM25 contribution
 * @returns {Array<{text, source, score, semanticScore, keywordScore}>}
 */
export function retrieveTopK(sessionId, queryVector, k = 5, queryText = '') {
  return hybridRetrieve(sessionId, queryVector, queryText, k);
}

// ── Session Helpers ───────────────────────────────────────────────────────────

/** Check if a session exists and has data */
export function sessionExists(sessionId) {
  const s = sessions.get(sessionId);
  return !!s && s.entries.length > 0;
}

/** Delete a session's data */
export function clearSession(sessionId) {
  sessions.delete(sessionId);
}
