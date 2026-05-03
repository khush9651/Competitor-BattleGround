import { useState, useEffect } from 'react';
import axios from 'axios';
import { normalizeStructuredSources } from '../utils/sources.js';

const NEI = 'Not enough information found';

function ConfidenceRibbon({ confidence }) {
  if (!confidence?.label) return null;
  const isLow = confidence.label === 'Low';
  const ring =
    confidence.label === 'High'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-200'
      : confidence.label === 'Medium'
        ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200'
        : 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/35 dark:bg-red-950/35 dark:text-red-200';

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed transition-colors duration-300 ${ring}`}
    >
      <strong>Retrieval confidence:</strong> {confidence.label}
      {typeof confidence.value === 'number' && (
        <span className="ml-2 font-mono opacity-90">({confidence.value.toFixed(2)})</span>
      )}
      {isLow && (
        <span className="block mt-1 opacity-95">
          Low overlap with your description — treated as unreliable unless excerpts align.
        </span>
      )}
    </div>
  );
}

export default function IcpMatchPanel({ sessionId }) {
  const [product, setProduct] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [highDemandHint, setHighDemandHint] = useState(false);

  useEffect(() => {
    if (!loading) {
      setHighDemandHint(false);
      return undefined;
    }
    const t = setTimeout(() => setHighDemandHint(true), 2700);
    return () => clearTimeout(t);
  }, [loading]);

  const runMatch = async () => {
    const text = product.trim();
    if (!sessionId || !text) return;

    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await axios.post('/api/match', {
        sessionId,
        userProduct: text,
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Match request failed.');
    } finally {
      setLoading(false);
    }
  };

  const icp = data?.icp_match;
  const structured = normalizeStructuredSources(data?.sources ?? []);
  const score = typeof icp?.match_score === 'number' ? icp.match_score : null;

  return (
    <section className="rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white/90 p-5 shadow-xl transition-colors duration-300 dark:border-violet-500/25 dark:from-violet-950/30 dark:to-slate-900/50">
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700 transition-colors duration-300 dark:text-violet-300">
        ICP match score
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 transition-colors duration-300 dark:text-slate-400">
        Describe your product and ideal buyer. Scoring uses retrieval over the same scraped corpus —
        strict RAG only.
      </p>

      <textarea
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        rows={4}
        disabled={loading}
        placeholder="e.g. Mid-market B2B SaaS for RevOps teams; integrates with Salesforce and HubSpot…"
        className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-inner transition-colors duration-300 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/15 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-600"
      />

      <button
        type="button"
        disabled={!sessionId || loading || product.trim().length < 12}
        onClick={runMatch}
        className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-violet-900/40"
      >
        {loading ? 'Scoring…' : 'Score ICP match'}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      {loading && highDemandHint && (
        <p
          role="status"
          className="mt-3 text-[11px] font-medium leading-relaxed text-amber-800 transition-colors duration-300 dark:text-amber-200/90"
        >
          High demand — switching to backup model…
        </p>
      )}

      {data && (
        <div className="mt-5 space-y-4">
          {data.llm?.provider && data.llm.provider !== 'groq' && (
            <p className="rounded-lg border border-cyan-400/35 bg-cyan-50 px-3 py-2 text-xs text-cyan-950 dark:bg-cyan-950/35 dark:text-cyan-100">
              Scored with backup capacity ({data.llm.provider}); still constrained to scraped context.
            </p>
          )}
          {data.confidence && <ConfidenceRibbon confidence={data.confidence} />}

          {score !== null && (
            <div className="flex items-end gap-3">
              <div className="text-4xl font-black tabular-nums text-violet-700 dark:text-violet-300">
                {score}%
              </div>
              <span className="pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                overlap estimate
              </span>
            </div>
          )}

          <div className="rounded-lg border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-950/40">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
              Overlap summary
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {icp?.overlap_summary || NEI}
            </p>
          </div>

          {Array.isArray(icp?.mismatch_insights) && icp.mismatch_insights.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Target / positioning mismatches
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {icp.mismatch_insights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(icp?.supporting_points) && icp.supporting_points.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Grounded claims
              </p>
              <ul className="space-y-2">
                {icp.supporting_points.map((row, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-200/70 bg-slate-50/80 p-2 text-xs dark:border-white/10 dark:bg-slate-950/40"
                  >
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {row.claim || NEI}
                    </span>
                    <blockquote className="mt-1 border-l-2 border-violet-400 pl-2 text-slate-600 dark:border-violet-500/60 dark:text-slate-400">
                      {row.supporting_text || NEI}
                    </blockquote>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {structured.length > 0 && (
            <details className="rounded-lg border border-slate-200/80 bg-slate-50/50 dark:border-white/10 dark:bg-slate-950/30">
              <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Retrieval snippets ({structured.length})
              </summary>
              <div className="space-y-2 border-t border-slate-200/60 p-3 dark:border-white/10">
                {structured.map((src, idx) => (
                  <blockquote
                    key={`${src.url}-${idx}`}
                    className="border-l-2 border-violet-400 pl-2 text-[11px] text-slate-600 dark:border-violet-500/55 dark:text-slate-400"
                  >
                    {src.text?.trim() || NEI}
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
                    >
                      source
                    </a>
                  </blockquote>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
