/**
 * server.js — Competitor Battleground Backend
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import analyzeRouter from './src/routes/analyze.js';
import askRouter from './src/routes/ask.js';
import matchRouter from './src/routes/match.js';
import { getGroqApiKeySet } from './src/groqClient.js';
import { getOpenAIConfigured } from './src/openaiClient.js';
import { getGeminiConfigured } from './src/geminiClient.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Detect environment
const isProduction = process.env.NODE_ENV === 'production';

// Allowed origins
const allowedOrigins = isProduction
  ? [process.env.FRONTEND_ORIGIN] // from Render env
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.set('trust proxy', 1);

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────
app.use('/api/analyze', analyzeRouter);
app.use('/api/ask', askRouter);
app.use('/api/match', matchRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    time: new Date().toISOString(),
    llm_providers: {
      groq: getGroqApiKeySet(),
      openai: getOpenAIConfigured(),
      gemini: getGeminiConfigured(),
    },
  });
});

// Root route (VERY IMPORTANT for Render test)
app.get('/', (_req, res) => {
  res.send('🚀 Competitor Battleground API is running');
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[server] Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Competitor Battleground API`);
  console.log(`Listening on port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`\n`);
});
