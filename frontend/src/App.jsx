import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import HeroInput from './components/HeroInput.jsx';
import LoadingSteps from './components/LoadingSteps.jsx';
import BattleCard from './components/BattleCard.jsx';
import AdvancedInsights from './components/AdvancedInsights.jsx';
import IcpMatchPanel from './components/IcpMatchPanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { useAnalysisProgress } from './hooks/useAnalysisProgress.js';

const STEPS = [
  {
    id: 'scrape',
    name: 'Scraped pages',
    desc: 'Depth-2 crawl of competitor site & internal priority links',
    icon: '🌐',
  },
  {
    id: 'chunk',
    name: 'Processed content',
    desc: 'Chunking, incremental embeddings (new or changed pages only)',
    icon: '✂️',
  },
  {
    id: 'embed',
    name: 'Vector index',
    desc: 'Hybrid index ready (semantic + BM25 fusion)',
    icon: '🧠',
  },
  {
    id: 'retrieve',
    name: 'Retrieved insights',
    desc: 'Top contextual chunks merged for grounding',
    icon: '🔍',
  },
  {
    id: 'generate',
    name: 'Generating Battleground…',
    desc: 'Single-pass LLM — full structured output from context',
    icon: '⚡',
  },
];

const DOC_TITLE = 'Battleground — AI competitive intelligence';

export default function App() {
  useEffect(() => {
    document.title = DOC_TITLE;
  }, []);

  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [inputUrl, setInputUrl] = useState('');
  const [highDemandHint, setHighDemandHint] = useState(false);
  const [analyzeSubmitting, setAnalyzeSubmitting] = useState(false);

  useEffect(() => {
    if (phase !== 'loading') {
      setHighDemandHint(false);
      return undefined;
    }
    const t = setTimeout(() => setHighDemandHint(true), 2700);
    return () => clearTimeout(t);
  }, [phase]);

  const analysisProgress = useAnalysisProgress({
    progressMs:       720,
    finalDoneMs:      420,
    fastRemainderMs:   185,
  });

  const handleAnalyze = useCallback(
    async (url, tone) => {
      setAnalyzeSubmitting(true);
      setPhase('loading');
      setError('');
      setResult(null);
      setInputUrl(url);

      analysisProgress.startProgress();

      try {
        const res = await axios.post('/api/analyze', { url, tone }, { timeout: 120000 });

        await analysisProgress.finalizeSuccess();

        setResult(res.data);
        setPhase('result');
      } catch (err) {
        analysisProgress.cancelProgress();
        analysisProgress.resetProgress();

        const msg =
          err.response?.data?.error || err.message || 'An unexpected error occurred.';
        setError(msg);
        setPhase('error');
      } finally {
        setAnalyzeSubmitting(false);
      }
    },
    [analysisProgress],
  );

  const handleReset = () => {
    analysisProgress.cancelProgress();
    analysisProgress.resetProgress();
    setPhase('idle');
    setResult(null);
    setError('');
  };

  const stepsWithStatus =
    phase === 'loading'
      ? STEPS.map((s, i) => ({
          ...s,
          status: analysisProgress.statuses[i] ?? 'pending',
        }))
      : [];

  return (
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(99,102,241,0.12),transparent)] transition-colors duration-300 dark:bg-slate-950 dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(99,102,241,0.18),transparent)]">
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <a
            href="/"
            className="flex min-w-0 items-center text-lg font-black tracking-tight sm:text-xl"
            onClick={(e) => {
              e.preventDefault();
              handleReset();
            }}
          >
            <span className="truncate bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-cyan-400">
              Battleground
            </span>
          </a>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <span className="rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-md sm:px-3 sm:text-[10px] dark:shadow-lg">
              RAG · SaaS
            </span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:pb-28">
        {(phase === 'idle' || phase === 'error') && (
          <div className="animate-[fadeIn_0.45s_ease-out] motion-reduce:animate-none">
            <section className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                Intelligence workspace
              </p>
              <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight text-slate-900 transition-colors duration-300 dark:text-white sm:text-5xl">
                Win every deal with AI{' '}
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-cyan-400">
                  Battleground
                </span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 transition-colors duration-300 dark:text-slate-400 sm:text-base">
                Paste a competitor URL. We crawl, hybrid-retrieve grounded context, and produce a structured
                dashboard—charts for quick scan, prose for depth, editable strengths & positioning.
              </p>
            </section>

            <HeroInput onAnalyze={handleAnalyze} loading={analyzeSubmitting} />

            {phase === 'error' && (
              <div
                role="alert"
                className="mx-auto mt-6 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 transition-colors duration-300 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200"
              >
                <span className="mr-2" aria-hidden>
                  ⚠️
                </span>
                {error}
              </div>
            )}
          </div>
        )}

        {phase === 'loading' && (
          <div className="animate-[fadeIn_0.35s_ease-out]">
            <LoadingSteps steps={stepsWithStatus} highDemandHint={highDemandHint} />
          </div>
        )}

        {phase === 'result' && result && (
          <div className="animate-[fadeIn_0.45s_ease-out]">
            <div className="w-full min-w-0 space-y-10">
              {result.llm?.provider && result.llm.provider !== 'groq' && (
                <div
                  role="status"
                  className="rounded-xl border border-cyan-200/80 bg-cyan-50/90 px-4 py-3 text-sm text-cyan-950 shadow-sm transition-colors duration-300 dark:border-cyan-500/35 dark:bg-cyan-950/35 dark:text-cyan-100"
                >
                  This run used backup capacity ({result.llm.provider}). Results stay grounded on the
                  same crawl.
                </div>
              )}
              <BattleCard
                battlecard={result.battlecard}
                sources={result.sources}
                confidence={result.confidence}
                url={inputUrl}
                cached={result.cached}
                onReset={handleReset}
                aside={<ChatPanel sessionId={result.sessionId} />}
              />
              <AdvancedInsights
                swot={result.swot}
                sales_insights={result.sales_insights}
                pricing_intelligence={result.pricing_intelligence}
              />
              <IcpMatchPanel sessionId={result.sessionId} />
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
