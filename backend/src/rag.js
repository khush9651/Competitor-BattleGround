/**
 * rag.js — Competitor Battleground
 *
 * Strict RAG pipeline rules:
 *  1. ALWAYS retrieve top-K chunks BEFORE calling LLM (full K for sources/snippets)
 *  2. Pass a capped subset + truncated text to the LLM in ONE call (battlecard / ask each)
 *  3. NEVER use external knowledge — only scraped context
 */

import { embed } from './embedder.js';
import { retrieveTopK } from './vectorStore.js';
import { pickBestSentence } from './sentencePick.js';
import { completeChat } from './llmRouter.js';

export const TOP_K = 5;

/** Chunks sent to the LLM (clamped 3–5). Retrieved list stays at TOP_K for grounding UI sources. Default 4 to reduce upstream load. */
const LLM_TOP_K = Math.min(5, Math.max(3, parseInt(process.env.LLM_CONTEXT_CHUNKS || '4', 10)));
const LLM_MAX_CHARS_PER_CHUNK = parseInt(process.env.LLM_MAX_CHARS_PER_CHUNK || '2000', 10);

export const BATTLECARD_RETRIEVAL_QUERY =
  'company overview target audience features pricing strengths weaknesses positioning value proposition';

const SEMANTIC_CONFIDENCE_FLOOR = 0.18;

export const NEI_FALLBACK = 'Not enough information found';

// ── Prompt Templates ─────────────────────────────────────────────────────────

/** Full-bundle response: prose battlecard + SWOT + sales + pricing intel (single JSON object). */
const INSIGHTS_JSON_SYSTEM_PROMPT = `You are a strict competitive intelligence analyst.

ABSOLUTE RULES:
- You MUST use ONLY the context provided in the user message. No training data. No guesses beyond what is directly supported.
- Every bullet in swot.*, sales_insights.*, or pricing intelligence MUST include supporting_text quoting or tightly paraphrasing ONLY that context (short excerpt).
- If a category has no grounding in the context, use an empty JSON array [] for that list and set string fields where applicable to "${NEI_FALLBACK}" exactly.
- For pricing: you may LABEL signals visibly present (e.g. phrases like "contact sales", "enterprise", "free tier") — still cite supporting_text from context only.
- Return ONLY valid minified JSON. No markdown fences, no commentary before or after.`;

function INSIGHTS_JSON_USER_PROMPT(context, tone) {
  return `TONE for prose sections: ${tone}

CONTEXT — ONLY SOURCE (scraped competitor site):
===BEGIN CONTEXT===
${context}
===END CONTEXT===

Respond with ONE JSON object (no markdown) exactly matching this shape and key names:

{
  "battlecard": {
    "companySummary": "string",
    "targetAudience": "string",
    "valueProposition": "string",
    "features": "string",
    "pricing": "string",
    "strengths": "string",
    "weaknesses": "string",
    "positioning": "string"
  },
  "swot": {
    "strengths": [{ "point": "string", "supporting_text": "string" }],
    "weaknesses": [{ "point": "string", "supporting_text": "string" }],
    "opportunities": [{ "point": "string", "supporting_text": "string" }],
    "threats": [{ "point": "string", "supporting_text": "string" }]
  },
  "sales_insights": {
    "objection_handling": [{ "insight": "string", "supporting_text": "string" }],
    "pitch_angles": [{ "insight": "string", "supporting_text": "string" }],
    "weakness_exploitation": [{ "insight": "string", "supporting_text": "string" }]
  },
  "pricing_intelligence": {
    "model_guess": "string",
    "confidence": "Low or Medium or High (string)",
    "signals_detected": ["string"],
    "supporting_text": ["string"]
  }
}

Use "${NEI_FALLBACK}" for any battlecard prose field with no usable context (each field is standalone).
Keep lists [] when there is nothing grounded. Pricing confidence reflects how explicit the pricing clues are IN THE CONTEXT ONLY.`;

}

const MATCH_ICP_SYSTEM_PROMPT = `You are a strict analyst comparing a USER PRODUCT DESCRIPTION to CONTEXT about a competitor (scraped site only).

RULES:
- Use ONLY the provided context for facts about the competitor. The userProduct text describes the user's offer — treat it only as intent to compare overlap vs what the CONTEXT says about the competitor's ICP / audience / use cases / segments.
- Do NOT invent competitor capabilities not stated in context.
- match_score must be an integer 0–100 estimating audience/use-case overlap between userProduct and the competitor positioning implied by context; if overlap cannot be judged from context, use 0 and explain via "${NEI_FALLBACK}" in overlap_summary.
- mismatch_insights: bullet strings where positioning/audience differs (from context vs userProduct), or empty if unknown.
Output ONLY valid JSON, no fences: {"match_score": number, "overlap_summary": "string", "mismatch_insights": ["string"], "supporting_points": [{"claim": "string", "supporting_text": "string"}]}
supporting_points must cite snippets from CONTEXT only.`; 

function MATCH_ICP_USER_PROMPT(userProduct, context) {
  return `USER PRODUCT (seller's pitch — NOT a second knowledge source):\n"${userProduct}"\n\nCOMPETITOR CONTEXT (only factual source):\n===BEGIN CONTEXT===\n${context}\n===END CONTEXT===`;
}

const ASK_SYSTEM_PROMPT = `You are a strict competitive intelligence assistant.

ABSOLUTE RULES:
- Answer ONLY from the provided context. No exceptions.
- Do NOT use any external knowledge or training data.
- If the answer is not clearly present in the context, respond with exactly: "Not enough information found"
- Quote or closely paraphrase the context when answering.
- Be concise and factual.`;

const ASK_USER_PROMPT = (context, question) => `
CONTEXT (scraped from competitor website — this is the ONLY source you may use):
===BEGIN CONTEXT===
${context}
===END CONTEXT===

QUESTION: ${question}

Answer STRICTLY from the context above in ONE reply. If the answer is not in the context, say "Not enough information found":`;

// ── LLM context shaping (smaller prompts, same retrieval set for citations) ───

function truncateForLlm(text, maxChars) {
  const t = String(text).trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Parse first top-level `{ ... }` from model output (strips optional ```json fences). */
export function extractFirstJsonObject(raw) {
  let s = String(raw).trim();
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fenced) s = fenced[1].trim();
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No JSON object in model output');

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(s.slice(start, i + 1));
      }
    }
  }
  throw new Error('Unbalanced JSON in model output');
}

function normalizeKeyedBullets(rows, primary, secondary, labelForString) {
  if (!Array.isArray(rows)) return [];
  /** @type {{ point?: string; insight?: string; supporting_text?: string }} */
  const out = [];
  for (const row of rows) {
    if (typeof row === 'string') {
      const t = row.trim();
      if (t) out.push({ [primary]: t, supporting_text: NEI_FALLBACK });
      continue;
    }
    if (!row || typeof row !== 'object') continue;
    const main =
      typeof row[primary] === 'string'
        ? row[primary].trim()
        : typeof row[labelForString || 'point'] === 'string'
          ? /** @type {string} */ (row[labelForString || 'point']).trim()
          : '';
    const support =
      typeof row.supporting_text === 'string' && row.supporting_text.trim()
        ? row.supporting_text.trim()
        : typeof row.supportingText === 'string' && row.supportingText.trim()
          ? row.supportingText.trim()
          : NEI_FALLBACK;
    if (!main && support === NEI_FALLBACK) continue;
    const item = {};
    item[primary] = main || NEI_FALLBACK;
    item.supporting_text = support;
    out.push(item);
  }
  return out;
}

function normalizeSwot(sw) {
  const empty = () => ({
    strengths: [], weaknesses: [], opportunities: [], threats: [],
  });
  if (!sw || typeof sw !== 'object') return empty();

  const pick = (k) => normalizeKeyedBullets(sw[k], 'point', '', 'point');
  return {
    strengths:     pick('strengths'),
    weaknesses:    pick('weaknesses'),
    opportunities: pick('opportunities'),
    threats:       pick('threats'),
  };
}

function normalizeSalesInsights(s) {
  const empty = () => ({
    objection_handling: [],
    pitch_angles: [],
    weakness_exploitation: [],
  });
  if (!s || typeof s !== 'object') return empty();

  return {
    objection_handling:
      normalizeKeyedBullets(s.objection_handling, 'insight', '', 'insight'),
    pitch_angles: normalizeKeyedBullets(s.pitch_angles, 'insight', '', 'insight'),
    weakness_exploitation:
      normalizeKeyedBullets(s.weakness_exploitation, 'insight', '', 'insight'),
  };
}

function normalizePricingIntel(p) {
  const nei = NEI_FALLBACK;
  const base = {
    model_guess: nei,
    confidence: 'Low',
    signals_detected: /** @type {string[]} */ ([]),
    supporting_text: /** @type {string[]} */ ([]),
  };
  if (!p || typeof p !== 'object') return base;

  const confRaw = typeof p.confidence === 'string' ? p.confidence.trim() : 'Low';
  const confUpper = ['High', 'Medium', 'Low'].includes(confRaw) ? confRaw : 'Low';

  const signals = Array.isArray(p.signals_detected)
    ? p.signals_detected.map((x) => String(x).trim()).filter(Boolean)
    : [];

  let supporting = Array.isArray(p.supporting_text)
    ? p.supporting_text.map((x) => String(x).trim()).filter(Boolean)
    : [];

  let modelGuess =
    typeof p.model_guess === 'string' && p.model_guess.trim()
      ? p.model_guess.trim()
      : nei;

  if (
    signals.length === 0 &&
    supporting.length === 0 &&
    modelGuess === nei
  ) {
    supporting = []; // unchanged
  } else if (typeof p.pricing_notes === 'string' && supporting.length === 0) {
    const n = p.pricing_notes.trim();
    if (n) supporting = [n];
  }

  return {
    model_guess: modelGuess,
    confidence: confUpper,
    signals_detected: signals,
    supporting_text:
      supporting.length > 0
        ? supporting
        : modelGuess !== nei || signals.length > 0
          ? supporting
          : [],
  };
}

/** @param {*} parsed LLM JSON */
export function normalizeFullInsightsBundle(parsed) {
  const FALLBACK = NEI_FALLBACK;
  const bcIn = parsed?.battlecard && typeof parsed.battlecard === 'object' ? parsed.battlecard : {};
  /** @type {Record<string,string>} */
  const battlecard = {};

  const keys = [
    'companySummary',
    'targetAudience',
    'valueProposition',
    'features',
    'pricing',
    'strengths',
    'weaknesses',
    'positioning',
  ];
  for (const k of keys) {
    battlecard[k] =
      typeof bcIn[k] === 'string' && bcIn[k].trim()
        ? bcIn[k].trim()
        : FALLBACK;
  }

  return {
    battlecard,
    swot:                normalizeSwot(parsed?.swot),
    sales_insights:      normalizeSalesInsights(parsed?.sales_insights),
    pricing_intelligence: normalizePricingIntel(parsed?.pricing_intelligence),
  };
}

/**
 * Build prompt context: top `LLM_TOP_K` chunks only, each truncated.
 * @param {Array<{ text: string, source: string }>} topChunks
 */
function buildLlmContextString(topChunks) {
  const slice = topChunks.slice(0, LLM_TOP_K);
  return slice
    .map(
      (c, i) =>
        `[Chunk ${i + 1} | Source: ${c.source}]\n${truncateForLlm(c.text, LLM_MAX_CHARS_PER_CHUNK)}`,
    )
    .join('\n\n---\n\n');
}

async function llmComplete(systemPrompt, userPrompt, max_tokens) {
  return completeChat({ systemPrompt, userPrompt, max_tokens });
}

// ── Confidence + sources ───────────────────────────────────────────────────────

/** @typedef {{ text: string, url: string, score: number }} StructuredSource */

export function confidenceLabelFromMaxScore(value) {
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped > 0.75) return { value: clamped, label: 'High' };
  if (clamped >= 0.5) return { value: clamped, label: 'Medium' };
  return { value: clamped, label: 'Low' };
}

/** Max normalized semantic component from hybrid-retrieved chunks (pre-fusion semanticScore). */
function maxSemanticRaw(topChunks) {
  if (!topChunks.length) return 0;
  return Math.max(
    ...topChunks.map((c) => {
      if (typeof c.semanticScore === 'number') return c.semanticScore;
      if (typeof c.semanticRaw === 'number') return c.semanticRaw;
      return 0;
    }),
  );
}

export function buildStructuredSources(topChunks, retrievalQuery) {
  /** @type {StructuredSource[]} */
  const out = [];
  const seen = new Set();
  for (const ch of topChunks) {
    const url = String(ch.source || '').trim();
    const snippet = pickBestSentence(ch.text, retrievalQuery);
    const fingerprint = `${url}|${snippet.slice(0, 100)}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push({
      text:   snippet,
      url:    url || 'unknown',
      score:  typeof ch.score === 'number' ? Math.round(ch.score * 1000) / 1000 : 0,
    });
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** @param {*} parsed model JSON for icp match */
export function normalizeIcpMatch(parsed) {
  let score = Number(parsed?.match_score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const overlap =
    typeof parsed?.overlap_summary === 'string' && parsed.overlap_summary.trim()
      ? parsed.overlap_summary.trim()
      : NEI_FALLBACK;

  const mismatch_insights = Array.isArray(parsed?.mismatch_insights)
    ? parsed.mismatch_insights.map((x) => String(x).trim()).filter(Boolean)
    : [];

  const supporting_points = Array.isArray(parsed?.supporting_points)
    ? parsed.supporting_points
        .filter((r) => r && typeof r === 'object')
        .map((r) => ({
          claim: typeof r.claim === 'string' && r.claim.trim() ? r.claim.trim() : NEI_FALLBACK,
          supporting_text:
            typeof r.supporting_text === 'string' && r.supporting_text.trim()
              ? r.supporting_text.trim()
              : NEI_FALLBACK,
        }))
    : [];

  return { match_score: score, overlap_summary: overlap, mismatch_insights, supporting_points };
}

/**
 * Single Groq call: prose battlecard + SWOT + sales + pricing intelligence (JSON), strict RAG.
 */
export async function generateBattlecard(sessionId, tone = 'Strategic') {
  const retrievalQuery = BATTLECARD_RETRIEVAL_QUERY;
  const queryVec       = await embed(retrievalQuery);
  const topChunks      = retrieveTopK(sessionId, queryVec, TOP_K, retrievalQuery);

  console.log(
    `[rag] Retrieved ${topChunks.length} chunks; sending top ${Math.min(LLM_TOP_K, topChunks.length)} to LLM (truncated ≤${LLM_MAX_CHARS_PER_CHUNK} chars/chunk)`,
  );

  if (topChunks.length === 0) {
    throw new Error('No context available. Cannot generate battlecard without retrieved chunks.');
  }

  const contextForLlm = buildLlmContextString(topChunks);
  const sources         = buildStructuredSources(topChunks, retrievalQuery);
  const confidence      = confidenceLabelFromMaxScore(Math.max(...topChunks.map((c) => c.score), 0));

  const maxTok = parseInt(
    process.env.GROQ_MAX_TOKENS_BATTLECARD || process.env.GROQ_MAX_TOKENS || '4096',
    10,
  );

  const { text: raw, provider } = await llmComplete(
    INSIGHTS_JSON_SYSTEM_PROMPT,
    INSIGHTS_JSON_USER_PROMPT(contextForLlm, tone),
    maxTok,
  );

  /** @type {ReturnType<typeof normalizeFullInsightsBundle>} */
  let bundle;
  try {
    bundle = normalizeFullInsightsBundle(extractFirstJsonObject(raw));
  } catch (e) {
    console.warn('[rag] Insights JSON parse failed, markdown fallback:', e?.message ?? e);
    const battlecard = parseMarkdownSections(raw);
    bundle = normalizeFullInsightsBundle({
      battlecard,
      swot: {},
      sales_insights: {},
      pricing_intelligence: {},
    });
  }

  const { battlecard, swot, sales_insights, pricing_intelligence } = bundle;

  return {
    battlecard,
    swot,
    sales_insights,
    pricing_intelligence,
    sources,
    confidence,
    icp_match: null,
    llm: { provider },
  };
}

/**
 * Compare user product description vs competitor corpus (retrieve + strict JSON LLM).
 */
export async function matchIcpAgainstSession(sessionId, userProductRaw) {
  const userProduct = String(userProductRaw || '').trim();
  const emptyConfidence = { value: 0, label: /** @type {'Low'} */ ('Low') };

  const icpFallback = () => ({
    icp_match: {
      match_score: 0,
      overlap_summary: NEI_FALLBACK,
      mismatch_insights: [],
      supporting_points: [],
    },
  });

  if (userProduct.length < 12) {
    return {
      ...icpFallback(),
      sources: [],
      confidence: emptyConfidence,
      llm: null,
    };
  }

  const retrievalQuery = `${userProduct} ideal customer profile audience segmentation use-case overlap`;

  let topChunks = [];
  try {
    const queryVec = await embed(retrievalQuery);
    topChunks = retrieveTopK(sessionId, queryVec, TOP_K, retrievalQuery);
  } catch {
    return {
      ...icpFallback(),
      sources: [],
      confidence: emptyConfidence,
      llm: null,
    };
  }

  if (topChunks.length === 0) {
    return {
      ...icpFallback(),
      sources: [],
      confidence: emptyConfidence,
      llm: null,
    };
  }

  const fusedMax = Math.max(...topChunks.map((c) => c.score), 0);
  const sources   = buildStructuredSources(topChunks, retrievalQuery);
  const confidence = confidenceLabelFromMaxScore(fusedMax);

  if (maxSemanticRaw(topChunks) < SEMANTIC_CONFIDENCE_FLOOR) {
    console.log('[rag] /match semantic floor — returning NEI without LLM');
    return {
      ...icpFallback(),
      sources,
      confidence: { ...confidence, label: 'Low' },
      llm: null,
    };
  }

  const contextForLlm = buildLlmContextString(topChunks);
  const maxTokMatch = parseInt(process.env.GROQ_MAX_TOKENS_MATCH || process.env.GROQ_MAX_TOKENS_ASK || '1024', 10);
  const { text: raw, provider } = await llmComplete(
    MATCH_ICP_SYSTEM_PROMPT,
    MATCH_ICP_USER_PROMPT(userProduct, contextForLlm),
    maxTokMatch,
  );

  /** @type {ReturnType<typeof normalizeIcpMatch>} */
  let icp_match;
  try {
    icp_match = normalizeIcpMatch(extractFirstJsonObject(raw));
  } catch {
    icp_match = icpFallback().icp_match;
  }

  return { icp_match, sources, confidence, llm: { provider } };
}

/**
 * One LLM completion per follow-up question (no loop over chunks).
 */
export async function answerQuestion(sessionId, question) {
  const q = question.trim();
  const queryVec  = await embed(q);
  const topChunks = retrieveTopK(sessionId, queryVec, TOP_K, q);

  console.log(`[rag] /ask retrieved ${topChunks.length} chunks for: "${q}"`);

  const emptyConfidence = { value: 0, label: 'Low' };

  if (topChunks.length === 0) {
    return { answer: NEI_FALLBACK, sources: [], confidence: emptyConfidence, llm: null };
  }

  if (maxSemanticRaw(topChunks) < SEMANTIC_CONFIDENCE_FLOOR) {
    const raw      = maxSemanticRaw(topChunks);
    const fusedMax = Math.max(...topChunks.map((c) => c.score), 0);
    const confidence = {
      value: Math.min(raw, fusedMax),
      label: 'Low',
    };
    console.log('[rag] Semantic floor not met — returning NEI without LLM');
    return { answer: NEI_FALLBACK, sources: [], confidence, llm: null };
  }

  const contextForLlm = buildLlmContextString(topChunks);
  const sources         = buildStructuredSources(topChunks, q);
  const confidence      = confidenceLabelFromMaxScore(Math.max(...topChunks.map((c) => c.score), 0));

  const maxTokAsk = parseInt(process.env.GROQ_MAX_TOKENS_ASK || '1024', 10);
  const { text: answer, provider } = await llmComplete(
    ASK_SYSTEM_PROMPT,
    ASK_USER_PROMPT(contextForLlm, question),
    maxTokAsk,
  );

  return { answer, sources, confidence, llm: { provider } };
}

// ── Markdown Parser ───────────────────────────────────────────────────────────

function parseMarkdownSections(markdown) {
  const FALLBACK = NEI_FALLBACK;

  const sectionMap = {
    companySummary:   /##\s*1\.\s*Company Summary([\s\S]*?)(?=##\s*\d|$)/i,
    targetAudience:   /##\s*2\.\s*Target Audience([\s\S]*?)(?=##\s*\d|$)/i,
    valueProposition: /##\s*3\.\s*Value Proposition([\s\S]*?)(?=##\s*\d|$)/i,
    features:         /##\s*4\.\s*Features[^#]*([\s\S]*?)(?=##\s*\d|$)/i,
    pricing:          /##\s*5\.\s*Pricing([\s\S]*?)(?=##\s*\d|$)/i,
    strengths:        /##\s*6\.\s*Strengths([\s\S]*?)(?=##\s*\d|$)/i,
    weaknesses:       /##\s*7\.\s*Weaknesses[^#]*([\s\S]*?)(?=##\s*\d|$)/i,
    positioning:      /##\s*8\.\s*Messaging[^#]*([\s\S]*?)(?=##\s*\d|$)/i,
  };

  const result = {};
  for (const [key, regex] of Object.entries(sectionMap)) {
    const match = markdown.match(regex);
    result[key] = match ? match[1].trim() : FALLBACK;
  }

  return result;
}
