/**
 * Serialize downstream LLM calls (single flight global) — avoids burst 429s across Groq + fallbacks.
 */

let tail = Promise.resolve();

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function withLlmSerialQueue(fn) {
  const started = tail.then(() => fn());
  tail = started.catch(() => {}).then(() => {});
  return started;
}
