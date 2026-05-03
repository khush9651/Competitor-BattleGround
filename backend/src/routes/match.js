/**
 * routes/match.js — POST /api/match
 *
 * ICP / fit score: user product description vs scraped competitor corpus (strict RAG).
 */

import { Router } from 'express';
import { sessionExists } from '../vectorStore.js';
import { matchIcpAgainstSession } from '../rag.js';
import { llmCooldown } from '../middleware/llmCooldown.js';
import {
  SERVER_BUSY_MESSAGE,
  isAllProvidersExhausted,
} from '../errors.js';

const router = Router();

router.use(llmCooldown);

router.post('/', async (req, res) => {
  const { sessionId, userProduct } = req.body;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required.' });
  }
  if (!userProduct || typeof userProduct !== 'string') {
    return res.status(400).json({ error: 'userProduct is required (describe your offer / ICP).' });
  }

  if (!sessionExists(sessionId)) {
    return res.status(404).json({
      error:
        'Session not found — run Analyze first in this workspace, then try ICP Match again.',
    });
  }

  try {
    const out = await matchIcpAgainstSession(sessionId, userProduct.trim());

    return res.json(out);
  } catch (err) {
    console.error('[match] Error:', err.message);
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
    return res.status(500).json({ error: `ICP match failed: ${msg}` });
  }
});

export default router;
