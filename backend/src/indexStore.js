/**
 * indexStore.js — Competitor Battleground
 *
 * Incremental indexing: tracks SHA-256 content hash per URL.
 * On re-analysis, only pages whose content has changed are re-embedded.
 *
 * Storage: in-memory Map (survives server restarts would need file-backing,
 * which can be added later with fs.writeFileSync to a JSON file).
 */

/** Map<url, hash> */
const hashStore = new Map();

/**
 * Get the stored hash for a URL, or null if not indexed yet.
 * @param {string} url
 * @returns {string|null}
 */
export function getPageHash(url) {
  return hashStore.get(normalizeUrl(url)) ?? null;
}

/**
 * Store the hash for a URL after indexing.
 * @param {string} url
 * @param {string} hash
 */
export function setPageHash(url, hash) {
  hashStore.set(normalizeUrl(url), hash);
}

/**
 * Returns true if the page content has changed (or was never indexed).
 * @param {string} url
 * @param {string} newHash
 * @returns {boolean}
 */
export function needsReindex(url, newHash) {
  const stored = getPageHash(url);
  if (stored === null) return true;          // never indexed
  if (stored !== newHash) return true;       // content changed
  return false;
}

/**
 * Mark a URL as indexed with the given hash.
 * Alias for setPageHash — clearer semantics at call sites.
 */
export function markIndexed(url, hash) {
  setPageHash(url, hash);
}

/** Clear all stored hashes (e.g. for testing) */
export function clearHashStore() {
  hashStore.clear();
}

/** Normalize URL for consistent keys */
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
