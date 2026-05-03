/**
 * Page-level embedding cache: normalized URL → { hash, chunks, vectors }
 * Persisted under backend/data/page-embed-cache.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'data');
const CACHE_PATH = join(DATA_DIR, 'page-embed-cache.json');
const MAX_ENTRIES = 80;

/** @type {Map<string, { hash: string, chunks: unknown[], vectors: number[][] }>} */
let cacheMap = null;

function normalizeCacheKey(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

function loadMap() {
  if (cacheMap) return cacheMap;
  cacheMap = new Map();
  try {
    if (!existsSync(CACHE_PATH)) return cacheMap;
    const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    const obj = raw.entries || {};
    for (const [k, v] of Object.entries(obj)) {
      if (v?.hash && Array.isArray(v.chunks) && Array.isArray(v.vectors))
        cacheMap.set(k, v);
    }
    console.log(`[pageEmbedCache] Loaded ${cacheMap.size} entr(y|ies)`);
  } catch (err) {
    console.warn('[pageEmbedCache] Failed to load cache:', err.message);
  }
  return cacheMap;
}

function persistMap() {
  const m = loadMap();
  const entries = {};
  for (const [k, v] of m.entries()) entries[k] = v;
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify({ entries, savedAt: new Date().toISOString() }));
}

export function pruneCacheOldest(map) {
  if (map.size <= MAX_ENTRIES) return;
  const keysToDrop = [...map.keys()].slice(0, map.size - MAX_ENTRIES);
  for (const k of keysToDrop) map.delete(k);
}

/**
 * @param {string} pageUrl
 * @param {string} hash
 */
export function getCachedPageEmbeddings(pageUrl, hash) {
  const key = normalizeCacheKey(pageUrl);
  const hit = loadMap().get(key);
  if (!hit || hit.hash !== hash) return null;
  return hit;
}

/**
 * @param {string} pageUrl
 * @param {string} hash
 * @param {Array<{ text: string, source: string, chunkIndex?: number }>} chunks
 * @param {number[][]} vectors
 */
export function setCachedPageEmbeddings(pageUrl, hash, chunks, vectors) {
  const map = loadMap();
  const key = normalizeCacheKey(pageUrl);
  map.set(key, {
    hash,
    chunks,
    vectors,
  });
  pruneCacheOldest(map);
  persistMap();
}

export { normalizeCacheKey };
