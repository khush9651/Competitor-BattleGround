/**
 * Primary Groq → OpenAI → Gemini fallback. One completion per invocation (serialized globally).
 */

import { callGroqChat, getGroqApiKeySet, isRateLimitError } from './groqClient.js';
import { callOpenAIChat, getOpenAIConfigured } from './openaiClient.js';
import { callGeminiChat, getGeminiConfigured } from './geminiClient.js';
import { withLlmSerialQueue } from './llmGate.js';
import { AllProvidersExhaustedError } from './errors.js';

function anyProviderConfigured() {
  return (
    getGroqApiKeySet() ||
    getOpenAIConfigured() ||
    getGeminiConfigured()
  );
}

async function tryGroq(opts) {
  if (!getGroqApiKeySet()) return null;
  try {
    const text = await callGroqChat(opts);
    return { text, provider: /** @type {const} */ ('groq') };
  } catch (e) {
    if (isRateLimitError(e)) {
      console.warn('[llm] Groq exhausted after retries — trying fallback providers');
      return null;
    }
    throw e;
  }
}

async function tryOpenAI(opts) {
  if (!getOpenAIConfigured()) return null;
  try {
    const text = await callOpenAIChat(opts);
    return { text, provider: /** @type {const} */ ('openai') };
  } catch (e) {
    if (isRateLimitError(e)) {
      console.warn('[llm] OpenAI rate limited — trying Gemini');
      return null;
    }
    throw e;
  }
}

async function tryGemini(opts) {
  if (!getGeminiConfigured()) return null;
  try {
    const text = await callGeminiChat(opts);
    return { text, provider: /** @type {const} */ ('gemini') };
  } catch (e) {
    if (isRateLimitError(e)) {
      console.warn('[llm] Gemini rate limited');
      return null;
    }
    throw e;
  }
}

/**
 * @typedef {{ provider: 'groq'|'openai'|'gemini'; text: string }} LlmOutcome
 */

/**
 * Ordered chat completion: Groq (default) → OpenAI → Gemini.
 *
 * @param {{ systemPrompt: string; userPrompt: string; max_tokens?: number; temperature?: number }} opts
 * @returns {Promise<LlmOutcome>}
 */
export async function completeChat(opts) {
  return withLlmSerialQueue(async () => {
    if (!anyProviderConfigured()) {
      throw new Error(
        'Server configuration error: set at least one of GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.',
      );
    }

    const groqOut = await tryGroq(opts);
    if (groqOut) return groqOut;

    const openaiOut = await tryOpenAI(opts);
    if (openaiOut) return openaiOut;

    const gemOut = await tryGemini(opts);
    if (gemOut) return gemOut;

    throw new AllProvidersExhaustedError();
  });
}
