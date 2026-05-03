const NEI = 'Not enough information found';

function emptySwot() {
  return {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  };
}

function emptySales() {
  return {
    objection_handling: [],
    pitch_angles: [],
    weakness_exploitation: [],
  };
}

function emptyPricing() {
  return {
    model_guess: NEI,
    confidence: 'Low',
    signals_detected: [],
    supporting_text: [],
  };
}

/** @param {{ items?: Array<{ point?: string; insight?: string; supporting_text?: string }>; primary: 'point' | 'insight' }} props */
function EvidenceList({ items, primary }) {
  if (!items?.length) {
    return <p className="text-sm italic text-slate-500 dark:text-slate-500">{NEI}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li
          key={i}
          className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/40"
        >
          <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {it?.[primary] || NEI}
          </p>
          <blockquote className="mt-2 border-l-2 border-indigo-400 pl-2 text-xs leading-relaxed text-slate-600 transition-colors duration-300 dark:border-indigo-500/70 dark:text-slate-400">
            {it?.supporting_text?.trim() || NEI}
          </blockquote>
        </li>
      ))}
    </ul>
  );
}

function QuadrantCard({ icon, badgeClass, title, items, primary }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white/80 p-4 shadow-lg transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/40">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-base ${badgeClass}`}
        >
          {icon}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">
          {title}
        </span>
      </div>
      <EvidenceList items={items} primary={primary} />
    </div>
  );
}

/** @param {{ pricing?: { model_guess?: string; confidence?: string; signals_detected?: string[]; supporting_text?: string[] } }} props */
function PricingIntelCard({ pricing }) {
  const p = pricing ?? emptyPricing();

  const conf =
    typeof p.confidence === 'string' && ['Low', 'Medium', 'High'].includes(p.confidence)
      ? p.confidence
      : 'Low';

  const confRing =
    conf === 'High'
      ? 'bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
      : conf === 'Medium'
        ? 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30'
        : 'bg-slate-100 text-slate-800 ring-slate-300 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15';

  const sigs = Array.isArray(p.signals_detected) ? p.signals_detected : [];
  const supp = Array.isArray(p.supporting_text) ? p.supporting_text : [];

  const hasBody =
    (p.model_guess && !p.model_guess.includes('Not enough information')) ||
    sigs.length > 0 ||
    supp.length > 0;

  return (
    <section className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-white/95 to-emerald-50/40 p-5 shadow-lg transition-colors duration-300 dark:border-emerald-500/25 dark:from-slate-900/50 dark:to-emerald-950/20">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-base ring-1 ring-emerald-200 transition-colors duration-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25">
          💳
        </span>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 transition-colors duration-300 dark:text-slate-400">
            Pricing intelligence
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-500">Signals inferred from scraped copy only.</p>
        </div>
        <span className={`ml-auto rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${confRing}`}>
          Confidence: {conf}
        </span>
      </div>

      {!hasBody ? (
        <p className="text-sm italic text-slate-500 dark:text-slate-500">{NEI}</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200/70 bg-white/70 p-3 text-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/30">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
              Model guess
            </span>
            <p className="mt-1 text-slate-800 dark:text-slate-200">{p.model_guess || NEI}</p>
          </div>

          {sigs.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Detected signals
              </p>
              <div className="flex flex-wrap gap-2">
                {sigs.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-900 transition-colors duration-300 dark:bg-indigo-500/15 dark:text-indigo-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {supp.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Supporting text
              </p>
              <ul className="space-y-2">
                {supp.map((t, i) => (
                  <li
                    key={i}
                    className="border-l-4 border-emerald-500/60 pl-3 text-xs leading-relaxed text-slate-700 dark:border-emerald-500/45 dark:text-slate-400"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function AdvancedInsights({ swot, sales_insights, pricing_intelligence }) {
  const s = swot && typeof swot === 'object' ? { ...emptySwot(), ...swot } : emptySwot();
  const sales =
    sales_insights && typeof sales_insights === 'object'
      ? { ...emptySales(), ...sales_insights }
      : emptySales();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 transition-colors duration-300 dark:text-indigo-400">
          Advanced insights
        </h2>
        <p className="mb-4 text-sm text-slate-600 transition-colors duration-300 dark:text-slate-400">
          SWOT bullets include supporting excerpts grounded in retrieval.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <QuadrantCard
            icon="➕"
            badgeClass="bg-teal-100 text-teal-900 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-500/25"
            title="Strengths"
            items={s.strengths}
            primary="point"
          />
          <QuadrantCard
            icon="⚠"
            badgeClass="bg-red-100 text-red-900 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-500/25"
            title="Weaknesses"
            items={s.weaknesses}
            primary="point"
          />
          <QuadrantCard
            icon="◎"
            badgeClass="bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:ring-cyan-500/25"
            title="Opportunities"
            items={s.opportunities}
            primary="point"
          />
          <QuadrantCard
            icon="!"
            badgeClass="bg-amber-100 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25"
            title="Threats"
            items={s.threats}
            primary="point"
          />
        </div>
      </section>

      <section className="rounded-xl border border-indigo-200/80 bg-white/85 p-5 shadow-xl transition-colors duration-300 dark:border-indigo-500/25 dark:bg-slate-900/45">
        <h3 className="text-sm font-black tracking-tight text-slate-900 transition-colors duration-300 dark:text-white">
          How to sell against this competitor
        </h3>
        <div className="mt-6 space-y-6">
          <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
              Objection handling
            </h4>
            <EvidenceList items={sales.objection_handling} primary="insight" />
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
              Pitch angles
            </h4>
            <EvidenceList items={sales.pitch_angles} primary="insight" />
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
              Weakness exploitation
            </h4>
            <EvidenceList items={sales.weakness_exploitation} primary="insight" />
          </div>
        </div>
      </section>

      <PricingIntelCard pricing={pricing_intelligence} />
    </div>
  );
}
