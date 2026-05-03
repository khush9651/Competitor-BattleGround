/**
 * Gemini REST fallback — no extra package; avoids adding another heavyweight SDK.
 */

import axios from 'axios';
import { isRateLimitError } from './groqClient.js';

const GEMINI_RETRY_DELAYS_MS = [2000, 4000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getGeminiConfigured() {
  return Boolean(String(process.env.GEMINI_API_KEY || '').trim());
}

/** @param {*} data Gemini generateContent JSON */
function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  const s = parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim();
  return s;
}

/**
 * @param {{ systemPrompt: string; userPrompt: string; max_tokens?: number; temperature?: number }} opts
 */
export async function callGeminiChat(opts) {
  const {
    systemPrompt,
    userPrompt,
    max_tokens  = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '3072', 10),
    temperature = 0.2,
  } = opts;

  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set in .env');
  }

  const model =
    process.env.GEMINI_MODEL?.replace(/^models\//, '') ||
    'gemini-2.0-flash';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let lastErr;
  const maxAttempts = 1 + GEMINI_RETRY_DELAYS_MS.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await axios.post(
        url,
        {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: Math.min(Math.max(max_tokens, 128), 8192),
          },
        },
        {
          params: { key },
          timeout: 120_000,
          validateStatus: () => true,
        },
      );

      const http = resp.status;
      const data = resp.data;

      if (http === 429 || http === 503) {
        if (attempt < maxAttempts - 1) {
          const waitMs = GEMINI_RETRY_DELAYS_MS[attempt];
          console.warn(`[gemini] HTTP ${http} — retry ${attempt + 1} after ${waitMs}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error(`Gemini HTTP ${http}`);
      }

      if (data?.error) {
        const rl =
          String(data.error.status || '').includes('RESOURCE_EXHAUSTED')
          || String(data.error.code || '').includes('RESOURCE_EXHAUSTED');

        const errStub = /** @type {any} */ ({
          message: `${data.error.message || 'Gemini API error'} (${data.error.status})`,
          status: rl ? 429 : http || 400,
        });
        if (attempt < maxAttempts - 1 && isRateLimitError(errStub)) {
          const waitMs = GEMINI_RETRY_DELAYS_MS[attempt];
          console.warn(`[gemini] rate-ish error — retry ${attempt + 1} after ${waitMs}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error(errStub.message);
      }

      if (http >= 400) {
        const msg =
          typeof data?.error?.message === 'string'
            ? data.error.message
            : typeof data === 'string'
              ? data
              : `Gemini HTTP ${http}`;
        throw new Error(msg);
      }

      const text = extractGeminiText(data);
      if (!text) {
        throw new Error('Empty completion from Gemini');
      }
      return text;
    } catch (err) {
      lastErr = err;
      /** @type {any} */
      const e = err;
      const rl = axios.isAxiosError(err)
        ? isRateLimitError({ status: e.response?.status, message: e.message })
          || String(e.response?.data?.error?.status || '').includes('RESOURCE_EXHAUSTED')
        : isRateLimitError(err);

      if (rl && attempt < maxAttempts - 1) {
        const waitMs = GEMINI_RETRY_DELAYS_MS[attempt];
        console.warn(`[gemini] rate limit — retry ${attempt + 1} after ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      /** Promote Axios message for debugging */
      if (axios.isAxiosError(err) && err.response?.data) {
        const msg =
          typeof err.response.data.error?.message === 'string'
            ? err.response.data.error.message
            : JSON.stringify(err.response.data).slice(0, 400);
        const wrapped = new Error(`Gemini: ${msg}`);
        wrapped.cause = err;
        throw wrapped;
      }
      throw err;
    }
  }

  throw lastErr;
}
