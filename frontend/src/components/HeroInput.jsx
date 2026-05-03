import { useState } from 'react';

const TONES = ['Strategic', 'Aggressive', 'Neutral'];

function isValidUrl(str) {
  try {
    const u = new URL(str.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function HeroInput({ onAnalyze, loading }) {
  const [url, setUrl] = useState('');
  const [tone, setTone] = useState('Strategic');
  const [err, setErr] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setErr('Please enter a URL.');
      return;
    }
    if (!isValidUrl(trimmed)) {
      setErr('Please enter a valid URL including https://');
      return;
    }
    setErr('');
    onAnalyze(trimmed, tone);
  };

  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/50 dark:shadow-indigo-950/40 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input
            id="competitor-url"
            type="text"
            placeholder="https://competitor.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setErr('');
            }}
            disabled={loading}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="min-h-[52px] flex-1 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-indigo-500/0 transition duration-300 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-600/80 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
          />
          <button
            id="generate-btn"
            type="submit"
            disabled={loading || !url.trim()}
            className="group relative min-h-[52px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-6 font-bold text-white shadow-cta ring-2 ring-white/20 transition duration-300 hover:scale-[1.02] hover:shadow-glow hover:ring-indigo-300/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-cta dark:ring-white/10 sm:min-w-[220px]"
          >
            <span className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-60" />
            <span className="relative flex items-center justify-center gap-2 text-sm sm:text-base">
              <span className="text-lg transition group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                ⚡
              </span>
              <span className="drop-shadow-md">
                <span className="font-semibold opacity-95">Generate </span>
                <span className="bg-gradient-to-r from-white to-indigo-100 bg-clip-text font-black tracking-tight text-transparent underline decoration-white/50 decoration-2 underline-offset-4 dark:decoration-white/40">
                  Battleground
                </span>
              </span>
            </span>
          </button>
        </div>

        {err && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 transition-colors duration-300 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
            {err}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors duration-300 dark:text-slate-500 sm:w-auto">
            Tone
          </span>
          {TONES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              disabled={loading}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition duration-300 sm:text-sm ${
                tone === t
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-md dark:border-indigo-400 dark:bg-indigo-500/25 dark:text-indigo-100 dark:shadow-glow-sm'
                  : 'border-slate-200 bg-slate-100/80 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-slate-200'
              }`}
            >
              {t === 'Strategic' ? '🎯 ' : t === 'Aggressive' ? '🔥 ' : '📊 '}
              {t}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
