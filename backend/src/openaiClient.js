/**
 * OpenAI fallback chat (Chat Completions) — shallow retries on HTTP 429.
 */

import OpenAI from 'openai';
import { isRateLimitError } from './groqClient.js';

const RETRY_DELAYS_MS = [2000, 4000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getOpenAIConfigured() {
  return Boolean(String(process.env.OPENAI_API_KEY || '').trim());
}

/**
 * @param {{ systemPrompt: string; userPrompt: string; max_tokens?: number; temperature?: number }} opts
 */
export async function callOpenAIChat(opts) {
  const {
    systemPrompt,
    userPrompt,
    max_tokens  = parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '3072', 10),
    temperature = 0.2,
  } = opts;

  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in .env');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const client = new OpenAI({ apiKey });

  let lastErr;
  /** One attempt + retries on 429 only. */
  const maxAttempts = 1 + RETRY_DELAYS_MS.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature,
        max_tokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const text = response.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Empty completion from OpenAI');
      }
      return text.trim();
    } catch (err) {
      lastErr = err;
      const rl = isRateLimitError(err);
      if (!rl || attempt >= maxAttempts - 1) {
        throw err;
      }
      const waitMs = RETRY_DELAYS_MS[attempt];
      console.warn(`[openai] rate limit — retry ${attempt + 1} after ${waitMs}ms`);
      await sleep(waitMs);
    }
  }

  throw lastErr;
}
