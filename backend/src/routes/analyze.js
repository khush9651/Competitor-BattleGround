/**
 * routes/analyze.js — POST /api/analyze
 *
 * Full RAG pipeline:
 *  crawl → chunk → embed (incremental per page) → store → hybrid retrieve → battlecard
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { crawlSite }         from '../crawler.js';
import { chunkPages }       from '../chunker.js';
import { embedBatch }       from '../embedder.js';
import { storeVectors }     from '../vectorStore.js';
import { generateBattlecard } from '../rag.js';
import { getCached, setCache } from '../cache.js';
import {
  getCachedPageEmbeddings,
  setCachedPageEmbeddings,
} from '../pageEmbedCache.js';
import { markIndexed }      from '../indexStore.js';
import { persistSessionToChroma } from '../chromaPersist.js';
import { llmCooldown }       from '../middleware/llmCooldown.js';
import { isAllProvidersExhausted, SERVER_BUSY_MESSAGE } from '../errors.js';

const router = Router();

router.use(llmCooldown);

const VALID_TONES = ['Strategic', 'Aggressive', 'Neutral'];

/** Shape expected by Advanced Insights Layer (merge with cached rows missing new fields). */
const INSIGHTS_DEFAULTS = {
  swot: {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  },
  sales_insights: {
    objection_handling: [],
    pitch_angles: [],
    weakness_exploitation: [],
  },
  pricing_intelligence: {
    model_guess: 'Not enough information found',
    confidence: 'Low',
    signals_detected: [],
    supporting_text: [],
  },
  icp_match: null,
};

router.post('/', async (req, res) => {
  const { url, tone = 'Strategic' } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required.' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL. Please include http:// or https://' });
  }

  const validatedTone = VALID_TONES.includes(tone) ? tone : 'Strategic';

  const cached = getCached(parsedUrl.href, validatedTone);
  if (cached) {
    console.log('[analyze] Returning cached result (URL + tone)');
    const swIn = cached.swot && typeof cached.swot === 'object' ? cached.swot : {};
    const siIn =
      cached.sales_insights && typeof cached.sales_insights === 'object'
        ? cached.sales_insights
        : {};
    const piIn =
      cached.pricing_intelligence && typeof cached.pricing_intelligence === 'object'
        ? cached.pricing_intelligence
        : {};
    return res.json({
      ...cached,
      cached: true,
      llm: cached.llm ?? null,
      icp_match: cached.icp_match ?? null,
      swot: {
        strengths:     Array.isArray(swIn.strengths) ? swIn.strengths : [],
        weaknesses:    Array.isArray(swIn.weaknesses) ? swIn.weaknesses : [],
        opportunities: Array.isArray(swIn.opportunities) ? swIn.opportunities : [],
        threats:       Array.isArray(swIn.threats) ? swIn.threats : [],
      },
      sales_insights: {
        objection_handling: Array.isArray(siIn.objection_handling)
          ? siIn.objection_handling
          : [],
        pitch_angles: Array.isArray(siIn.pitch_angles) ? siIn.pitch_angles : [],
        weakness_exploitation: Array.isArray(siIn.weakness_exploitation)
          ? siIn.weakness_exploitation
          : [],
      },
      pricing_intelligence: {
        ...INSIGHTS_DEFAULTS.pricing_intelligence,
        ...piIn,
      },
    });
  }

  try {
    console.log(`[analyze] STEP 1 — Depth-2 crawl: ${parsedUrl.href}`);
    const pages = await crawlSite(parsedUrl.href);

    if (!pages || pages.length === 0) {
      return res.status(422).json({
        error: 'Could not scrape any content from this URL. The site may block crawlers.',
      });
    }

    const mergedChunks  = [];
    const mergedVectors = [];

    console.log('[analyze] STEP 2 — Chunk + embed (incremental cache per URL)…');
    for (const page of pages) {
      const pageUrl = page.url;
      const body    = typeof page.rawText === 'string' ? page.rawText : page.text;
      const display = `[Source: ${pageUrl}]\n\n${body}`;

      const diskHit = getCachedPageEmbeddings(pageUrl, page.hash);
      if (diskHit) {
        mergedChunks.push(...diskHit.chunks);
        mergedVectors.push(...diskHit.vectors);
        markIndexed(pageUrl, page.hash);
        console.log(`[analyze]   ↳ reused disk cache (${diskHit.chunks.length} chunks) ${pageUrl}`);
        continue;
      }

      const pageChunks = chunkPages([{ url: pageUrl, text: display }]);
      if (pageChunks.length === 0) continue;

      const texts   = pageChunks.map(c => c.text);
      const vectors = await embedBatch(texts);

      mergedChunks.push(...pageChunks);
      mergedVectors.push(...vectors);

      setCachedPageEmbeddings(pageUrl, page.hash, pageChunks, vectors);
      markIndexed(pageUrl, page.hash);
      console.log(`[analyze]   ↳ embedded ${pageChunks.length} chunks for ${pageUrl}`);
    }

    if (mergedChunks.length === 0) {
      return res.status(422).json({ error: 'No text content could be extracted.' });
    }

    console.log(`[analyze] STEP 3 — Storing session (${mergedChunks.length} chunks + BM25 index)…`);
    const sessionId = uuidv4();
    storeVectors(sessionId, mergedChunks, mergedVectors);

    await persistSessionToChroma(sessionId, mergedChunks, mergedVectors).catch(() => {});

    console.log('[analyze] STEP 4 — Hybrid retrieve + battlecard…');
    const generated = await generateBattlecard(sessionId, validatedTone);
    const {
      battlecard,
      swot,
      sales_insights,
      pricing_intelligence,
      sources,
      confidence,
      icp_match,
      llm,
    } =
      generated;

    const result = {
      battlecard,
      swot,
      sales_insights,
      pricing_intelligence,
      icp_match,
      llm,
      sources,
      confidence,
      sessionId,
      cached: false,
    };
    setCache(parsedUrl.href, result, validatedTone);

    console.log('[analyze] ✓ Battlecard generated (one LLM call, URL cached)');
    return res.json(result);

  } catch (err) {
    console.error('[analyze] Error:', err.message);

    if (isAllProvidersExhausted(err)) {
      return res.status(503).json({ error: SERVER_BUSY_MESSAGE });
    }

    const msg = String(err?.message || err);
    if (msg.includes('Server configuration error')) {
      return res.status(500).json({ error: msg });
    }
    if (/rate_limit|429/i.test(msg)) {
      return res.status(503).json({ error: SERVER_BUSY_MESSAGE });
    }

    return res.status(500).json({ error: `Analysis failed: ${msg}` });
  }
});

export default router;
