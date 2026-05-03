/**
 * sentencePick.js — pick the best grounding sentences from a chunk vs a query.
 */

const MAX_SNIPPET = 400;

function tokenizeQuick(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function overlapScore(sentence, queryTerms) {
  if (queryTerms.length === 0 || !sentence.trim()) return 0;
  const sentTerms = new Set(tokenizeQuick(sentence));
  let hits = 0;
  for (const t of queryTerms) {
    if (sentTerms.has(t)) hits += 1;
  }
  return hits / queryTerms.length;
}

function splitIntoSentences(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const parts = cleaned.split(/(?<=[.!?])\s+/);
  const out = [];
  for (const p of parts) {
    const s = p.trim();
    if (s.length >= 20) out.push(s);
  }
  if (out.length === 0 && cleaned.length >= 20) return [cleaned.slice(0, MAX_SNIPPET)];
  return out;
}

/**
 * Extract 1–2 best snippets from chunk text aligned with the retrieval query.
 * @param {string} chunkText
 * @param {string} query
 * @returns {string}
 */
export function pickBestSentence(chunkText, query) {
  const queryTerms = tokenizeQuick(query);
  const sentences = splitIntoSentences(chunkText);

  if (sentences.length === 0) return chunkText.trim().slice(0, MAX_SNIPPET);

  const scored = sentences.map(s => ({
    text: s,
    score: overlapScore(s, queryTerms),
  }));

  scored.sort((a, b) => b.score - a.score);

  let combined = scored[0].text;
  if (scored[1] && scored[1].score > 0 && !combined.includes(scored[1].text.slice(0, 40))) {
    combined += ' ' + scored[1].text;
  }

  combined = combined.replace(/\[[^\]]*Source[^\]]*\]\s*/gi, '').trim();
  if (combined.length > MAX_SNIPPET) {
    combined = combined.slice(0, MAX_SNIPPET - 1).trimEnd() + '…';
  }
  return combined;
}
