/** User-facing response when Groq/OpenAI/Gemini are all exhausted (e.g. 429 storms). */
export const SERVER_BUSY_MESSAGE = 'Server busy. Please try again later.';

export class AllProvidersExhaustedError extends Error {
  constructor(message = SERVER_BUSY_MESSAGE) {
    super(message);
    this.name = 'AllProvidersExhaustedError';
  }
}

/** @param {unknown} err */
export function isAllProvidersExhausted(err) {
  if (err instanceof AllProvidersExhaustedError) return true;
  if (typeof err !== 'object' || err === null) return false;
  return /** @type {{ name?: string }} */ (err).name === 'AllProvidersExhaustedError';
}
