import { useState, useEffect, useMemo } from 'react';
import { normalizeStructuredSources } from '../utils/sources.js';
import BattleCharts, { BattleRadarCard, BattleStrengthsBarCard } from './BattleCharts.jsx';
import EditableSection from './EditableSection.jsx';
import SectionCard from './SectionCard.jsx';

const SECTION_META = [
  {
    key: 'companySummary',
    label: 'Company Summary',
    icon: '🏢',
    badge:
      'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25',
  },
  {
    key: 'targetAudience',
    label: 'Target Audience',
    icon: '🎯',
    badge:
      'bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/25',
  },
  {
    key: 'valueProposition',
    label: 'Value Proposition',
    icon: '💡',
    badge:
      'bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25',
  },
  {
    key: 'features',
    label: 'Features & Products',
    icon: '⚙️',
    badge:
      'bg-violet-100 text-violet-800 ring-1 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25',
  },
  {
    key: 'pricing',
    label: 'Pricing',
    icon: '💰',
    badge:
      'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
  },
  {
    key: 'strengths',
    label: 'Strengths',
    icon: '💪',
    badge:
      'bg-teal-100 text-teal-800 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/25',
    editable: true,
  },
  {
    key: 'weaknesses',
    label: 'Weaknesses / Gaps',
    icon: '⚠️',
    badge:
      'bg-red-100 text-red-800 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25',
  },
  {
    key: 'positioning',
    label: 'Messaging & Positioning',
    icon: '📣',
    badge:
      'bg-pink-100 text-pink-800 ring-1 ring-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/25',
    editable: true,
  },
];

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function ConfidencePill({ confidence }) {
  if (!confidence?.label) return null;
  const { value, label } = confidence;
  const ring =
    label === 'High'
      ? 'bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
      : label === 'Medium'
        ? 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30'
        : 'bg-red-100 text-red-900 ring-red-300 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25';
  return (
    <div
      className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ring-1 transition-colors duration-300 ${ring}`}
    >
      <span className="font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
        Confidence
      </span>
      <strong>{label}</strong>
      {typeof value === 'number' ? (
        <span className="font-mono opacity-90">{value.toFixed(2)}</span>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {import('react').ReactNode} [props.aside] — third column in top row (`md`: radar | bars | chat).
 */
export default function BattleCard({
  battlecard: initial,
  sources,
  confidence,
  url,
  cached,
  onReset,
  aside = null,
}) {
  const [bc, setBc] = useState(() => initial || {});

  useEffect(() => {
    setBc(initial || {});
  }, [initial]);

  const structured = useMemo(() => normalizeStructuredSources(sources), [sources]);

  const handleCopy = () => {
    const text = SECTION_META.map(
      (s) => `## ${s.label}\n${bc[s.key] || 'Not enough information found'}`,
    ).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  const patch = (key) => (v) => setBc((prev) => ({ ...prev, [key]: v }));

  const hasAside = Boolean(aside);

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 transition-colors duration-300 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 transition-colors duration-300 dark:text-indigo-400">
            {cached ? '⚡ Cached insight' : '✓ Live Battleground'}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 transition-colors duration-300 dark:text-white sm:text-3xl">
            {extractDomain(url)}
          </h1>
          {confidence && <ConfidencePill confidence={confidence} />}
          {confidence?.label === 'Low' && (
            <p className="mt-2 max-w-xl text-sm text-red-700 transition-colors duration-300 dark:text-red-300/90">
              Low retrieval confidence — cross-check with cited sources below.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors duration-300 hover:bg-slate-200 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            📋 Copy all
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-900 transition-colors duration-300 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
          >
            ↩ New analysis
          </button>
        </div>
      </header>

      {hasAside ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
          <div className="flex min-h-0 min-w-0 md:h-full">
            <BattleRadarCard battlecard={bc} />
          </div>
          <div className="flex min-h-0 min-w-0 md:h-full">
            <BattleStrengthsBarCard battlecard={bc} />
          </div>
          <div className="flex min-h-0 min-w-0 md:h-full">{aside}</div>
        </div>
      ) : (
        <BattleCharts battlecard={bc} />
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {SECTION_META.map((section) =>
          section.editable ? (
            <EditableSection
              key={section.key}
              label={section.label}
              icon={section.icon}
              badgeClass={section.badge}
              value={bc[section.key] ?? ''}
              onPatch={patch(section.key)}
            />
          ) : (
            <SectionCard
              key={section.key}
              label={section.label}
              icon={section.icon}
              badgeClass={section.badge}
              content={bc[section.key]}
            />
          ),
        )}
      </div>

      {structured.length > 0 && (
        <section className="rounded-xl border border-indigo-200/80 bg-white/90 p-5 transition-colors duration-300 dark:border-indigo-500/20 dark:bg-slate-900/50">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors duration-300 dark:text-slate-500">
            Grounding — supporting excerpts
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {structured.map((src, idx) => (
              <article
                key={`${src.url}-${idx}`}
                className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/50"
              >
                <blockquote className="border-l-4 border-indigo-400 pl-3 text-xs leading-relaxed text-slate-700 transition-colors duration-300 dark:border-indigo-500/70 dark:text-slate-400">
                  {src.text?.trim() || (
                    <span className="italic text-slate-500 dark:text-slate-600">Open link for context</span>
                  )}
                </blockquote>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs font-medium text-cyan-700 underline-offset-2 transition-colors hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
                  >
                    {src.url}
                  </a>
                  {typeof src.score === 'number' && src.score > 0 && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-mono text-[10px] text-indigo-800 transition-colors duration-300 dark:bg-indigo-500/20 dark:text-indigo-300">
                      {src.score.toFixed(2)}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
