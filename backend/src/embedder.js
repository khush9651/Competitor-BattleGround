/**
 * embedder.js — Competitor Battleground
 * Generates embeddings using @xenova/transformers (all-MiniLM-L6-v2).
 * Runs entirely in-process via WASM — no API key needed.
 * Model is downloaded once and cached in ~/.cache/huggingface/hub/
 */

import { pipeline } from '@xenova/transformers';

let _pipe = null;

/** Lazy-load the embedding pipeline (downloaded once). */
async function getPipeline() {
  if (!_pipe) {
    console.log('[embedder] Loading all-MiniLM-L6-v2 (first run may download ~25MB)…');
    _pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('[embedder] Model ready.');
  }
  return _pipe;
}

/**
 * Compute a single embedding vector for `text`.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Compute embeddings for an array of texts.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
  const results = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}
