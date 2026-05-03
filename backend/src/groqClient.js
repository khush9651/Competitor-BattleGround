/**
 * Groq chat completions with exponential backoff on HTTP 429 / rate limits.
 */

import Groq from 'groq-sdk';

const GROQ_MODEL      = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_API_KEY    = process.env.GROQ_API_KEY || '';
/** Delays after each 429 before retry 1, 2, 3 (seconds per spec: 2 → 4 → 8). */
const RETRY_DELAYS_MS = [2000, 4000, 8000];
/** One initial attempt + 3 retries. */
const MAX_RETRIES     = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getGroqApiKeySet() {
  return Boolean(GROQ_API_KEY);
}

export function getGroqModelName() {
  return GROQ_MODEL;
}

export function getGroqClient() {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set in .env');
  return new Groq({ apiKey: GROQ_API_KEY });
}

/**
 * Detect Groq / OpenAI-style transport rate-limit errors.
 * @param {unknown} err
 */
export function isRateLimitError(err) {
  const status =
    /** @type {{ status?: number; statusCode?: number; response?: { status?: number } }} */ (
      err
    )?.status
    ?? /** @type {{ status?: number }} */ (err)?.statusCode
    ?? /** @type {{ response?: { status?: number } }} */ (err)?.response?.status;
  const message = /** @type {{ message?: string }} */ (err)?.message ?? String(err ?? '');
  return status === 429 || /429|rate[_\s-]?limit|too many requests/i.test(message);
}

/**
 * Chat completion with up to 3 retries on rate limit (2s, 4s, 8s waits).
 *
 * @param {{ systemPrompt: string, userPrompt: string, max_tokens?: number, temperature?: number }} opts
 */
export async function callGroqChat(opts) {
  const {
    systemPrompt,
    userPrompt,
    max_tokens  = parseInt(process.env.GROQ_MAX_TOKENS || '3072', 10),
    temperature = 0.2,
  } = opts;

  const groq = getGroqClient();
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        model:       GROQ_MODEL,
        temperature,
        max_tokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const text = response.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Empty completion from Groq');
      }
      return text;
    } catch (err) {
      lastErr = err;
      const rateLimited = isRateLimitError(err);
      if (!rateLimited || attempt >= MAX_RETRIES) {
        if (rateLimited) {
          const wrapped = new Error(
            `Groq rate_limit (429): exhausted ${MAX_RETRIES} retries — ${/** @type {{ message?: string }} */ (err).message || err}`,
          );
          wrapped.cause = err;
          throw wrapped;
        }
        throw err;
      }
      const waitMs = RETRY_DELAYS_MS[attempt];
      console.warn(
        `[groq] rate limit (429) — retry ${attempt + 1}/${MAX_RETRIES} after ${waitMs}ms`,
      );
      await sleep(waitMs);
    }
  }

  throw lastErr;
}
