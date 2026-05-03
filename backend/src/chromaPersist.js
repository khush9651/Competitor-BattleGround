/**
 * Optional Chroma persistence behind USE_CHROMADB=true.
 * Does not participate in retrieval (hybrid search stays in-process).
 */

/**
 * Upsert embeddings for a completed analyze session into Chroma HTTP API.
 * @param {string} sessionId
 * @param {Array<{ text: string, source: string }>} chunks
 * @param {number[][]} vectors
 */
export async function persistSessionToChroma(sessionId, chunks, vectors) {
  if (process.env.USE_CHROMADB !== 'true' || !chunks?.length) return;

  try {
    const { ChromaClient } = await import('chromadb');
    const chromaHost = process.env.CHROMA_URL || process.env.CHROMA_HOST || 'http://localhost:8000';

    const client = new ChromaClient({ path: chromaHost });
    const suffix     = sessionId.replace(/-/g, '_').slice(0, 48);
    const collection = await client.getOrCreateCollection({
      name:        `battleground_${suffix}`,
      metadata:    { sessionId },
    });

    const ids = chunks.map((_, i) => `${suffix}_chunk_${i}`);

    await collection.upsert({
      ids,
      embeddings: vectors,
      documents:  chunks.map(c => c.text.slice(0, 8000)),
      metadatas:  chunks.map(c => ({
        source: String(c.source || ''),
        sessionId,
      })),
    });

    console.log(`[chroma] Upserted ${ids.length} vectors → collection '${collection.name}'`);
  } catch (err) {
    console.warn('[chroma] Optional persist skipped:', err.message);
  }
}
