# Competitor Battleground

AI competitive intelligence workspace that crawls a competitor site, runs a strict RAG pipeline, and produces a structured battlecard with follow-up Q&A and ICP fit scoring.

**Highlights**
1. **Battlecard generation** from a single URL using hybrid retrieval (semantic + BM25).
2. **Follow-up Q&A** grounded only in scraped sources.
3. **ICP match scoring** against the same retrieved corpus.

## Architecture

| Component | Tech | Default Port | Notes |
| --- | --- | --- | --- |
| Backend API | Express (Node) | `3001` | Serves `/api/*` routes |
| Frontend UI | React + Vite | `5173` | Dev server proxies `/api` to backend |

## Quickstart

**Backend**
```bash
cd backend
npm install
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Backend environment variables

Create `backend/.env` (or update the existing one) with the keys you need:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Yes (unless using OpenAI/Gemini) | — | Primary LLM provider |
| `GROQ_MODEL` | No | `llama-3.1-8b-instant` | Groq model name |
| `OPENAI_API_KEY` | No | — | Fallback LLM provider |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model name |
| `GEMINI_API_KEY` | No | — | Fallback LLM provider |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model name |
| `PORT` | No | `3001` | API server port |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
| `USE_CHROMADB` | No | `false` | Persist embeddings to Chroma |
| `CHROMA_URL` / `CHROMA_HOST` | No | `http://localhost:8000` | Chroma HTTP endpoint |
| `LLM_CONTEXT_CHUNKS` | No | `4` | Chunks sent to LLM (3–5) |
| `LLM_MAX_CHARS_PER_CHUNK` | No | `2000` | Max chars per chunk passed to LLM |

## API endpoints

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/analyze` | Crawl → retrieve → battlecard JSON |
| `POST` | `/api/ask` | Follow-up Q&A (strict RAG) |
| `POST` | `/api/match` | ICP match score for a session |
| `GET` | `/api/health` | Health + provider readiness |

## License

See [LICENSE](LICENSE).
