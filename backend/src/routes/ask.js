/**
 * routes/ask.js — POST /api/ask
 *
 * Follow-up Q&A using strict RAG:
 *  1. Validate session + question
 *  2. Retrieve top-5 relevant chunks
 *  3. Generate grounded answer (only from context)
 *  4. Return answer + source URLs
 */

import { Router } from 'express';
import { sessionExists }   from '../vectorStore.js';
import { answerQuestion }  from '../rag.js';
import { llmCooldown } from '../middleware/llmCooldown.js';
import {
  SERVER_BUSY_MESSAGE,
  isAllProvidersExhausted,
} from '../errors.js';

const router = Router();

router.use(llmCooldown);

router.post('/', async (req, res) => {
  const { sessionId, question } = req.body;

  // ── Validate inputs ─────────────────────────────────────────────────────────
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required.' });
  }
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return res.status(400).json({ error: 'A valid question is required.' });
  }
  if (!sessionExists(sessionId)) {
    return res.status(404).json({
      error: 'Session not found. Please generate a battlecard first.',
    });
  }

  try {
    // ── Retrieve top-5 + answer (strict RAG — no LLM without context) ─────────
    console.log(`[ask] Question for session ${sessionId}: "${question}"`);
    const {
      answer,
      sources,
      confidence,
      llm,
    } = await answerQuestion(sessionId, question.trim());

    return res.json({ answer, sources, confidence, llm });

  } catch (err) {
    console.error('[ask] Error:', err.message);
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
    return res.status(500).json({ error: `Failed to answer question: ${msg}` });
  }
});

export default router;
