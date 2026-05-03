/**
 * chunker.js — Competitor Battleground
 * Splits scraped page text into overlapping chunks (~300-500 tokens).
 * Uses character-count approximation: 1 token ≈ 4 chars.
 */

const CHUNK_SIZE   = 1800;  // ~450 tokens
const CHUNK_OVERLAP = 200;  // ~50 tokens overlap for continuity

/**
 * Split a single text string into overlapping chunks.
 * @param {string} text
 * @param {string} sourceUrl
 * @returns {Array<{text: string, source: string, chunkIndex: number}>}
 */
function splitText(text, sourceUrl) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 50) {   // Skip tiny tail chunks
      chunks.push({ text: chunk, source: sourceUrl, chunkIndex: chunks.length });
    }

    if (end === text.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

/**
 * Chunk all scraped pages.
 * @param {Array<{url: string, text: string}>} pages
 * @returns {Array<{text: string, source: string, chunkIndex: number}>}
 */
export function chunkPages(pages) {
  const allChunks = [];

  for (const { url, text } of pages) {
    const pageChunks = splitText(text, url);
    allChunks.push(...pageChunks);
    console.log(`[chunker] ${url} → ${pageChunks.length} chunk(s)`);
  }

  console.log(`[chunker] Total chunks: ${allChunks.length}`);
  return allChunks;
}
