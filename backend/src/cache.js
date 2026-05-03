/**
 * cache.js — Competitor Battleground
 * In-memory LRU-style cache: URL → { battlecard, sources, sessionId }
 * Prevents re-scraping the same competitor URL within the same server session.
 */

const MAX_ENTRIES = 50;
const cache = new Map();

/**
 * Stable cache key: host + path + tone (same URL + tone → same battlecard, skip Groq).
 * @param {string} url
 * @param {string} [tone='Strategic']
 */
function cacheKey(url, tone = 'Strategic') {
  try {
    const u = new URL(url);
    const base = `${u.hostname}${u.pathname}`.replace(/\/$/, '').toLowerCase();
    return `${base}::${tone}`;
  } catch {
    return `${String(url).toLowerCase()}::${tone}`;
  }
}

/**
 * Retrieve cached result for a URL + tone.
 * @param {string} url
 * @param {string} [tone]
 * @returns {object|null}
 */
export function getCached(url, tone = 'Strategic') {
  const key = cacheKey(url, tone);
  if (cache.has(key)) {
    console.log(`[cache] HIT for ${key}`);
    return cache.get(key);
  }
  return null;
}

/**
 * Store result in cache.
 * @param {string} url
 * @param {string} [tone]
 * @param {object} result  — { battlecard, sources, sessionId, confidence, … }
 */
export function setCache(url, result, tone = 'Strategic') {
  const key = cacheKey(url, tone);

  // Evict oldest entry if at capacity
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }

  cache.set(key, result);
  console.log(`[cache] Stored result for ${key}`);
}
