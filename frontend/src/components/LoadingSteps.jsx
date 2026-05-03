/** Small accessible spinner */
function StepSpinner({ className = '' }) {
  return (
    <span
      role="progressbar"
      aria-label="In progress"
      className={`inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-indigo-500/40 border-t-indigo-600 dark:border-indigo-400/30 dark:border-t-indigo-400 ${className}`}
    />
  );
}

/**
 * @param {{ steps: Array<{ id: string, name: string, desc: string, icon: string, status?: 'pending'|'loading'|'done' }>; highDemandHint?: boolean }} props
 */
export default function LoadingSteps({ steps, highDemandHint = false }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700 transition-colors duration-300 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75 dark:bg-indigo-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
          </span>
          AI thinking
        </span>
        <h2 className="mt-4 text-xl font-bold text-slate-900 transition-colors duration-300 dark:text-white sm:text-2xl">
          Building your Battleground
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 transition-colors duration-300 dark:text-slate-500">
          Each stage updates independently — generating finishes only after the server responds.
        </p>
        {highDemandHint && (
          <p
            role="status"
            className="mx-auto mt-3 max-w-md rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-950 transition-colors duration-300 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-200"
          >
            High demand — we may switch to a backup model automatically. Hang tight…
          </p>
        )}
      </div>

      <div
        aria-live="polite"
        aria-atomic="false"
        className="mt-10 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-md transition-colors duration-300 dark:divide-white/10 dark:border-white/10 dark:bg-slate-900/60"
      >
        {steps.map((step) => {
          const status = step.status ?? 'pending';
          const isDone    = status === 'done';
          const isLoading = status === 'loading';
          const isPending = status === 'pending';

          const rowClass = isDone
            ? 'bg-emerald-50/90 dark:bg-emerald-950/20'
            : isLoading
              ? 'bg-indigo-50/80 dark:bg-indigo-950/40'
              : 'opacity-[0.62] dark:opacity-[0.52]';

          const badgeText = isDone ? 'Done' : isLoading ? 'In progress…' : 'Waiting';

          return (
            <div key={step.id} className={`px-4 py-3.5 transition-colors duration-300 sm:px-5 ${rowClass}`}>
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg transition-colors duration-300 ${
                    isDone
                      ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300 dark:bg-emerald-500/25 dark:text-emerald-400 dark:ring-emerald-500/30'
                      : isLoading
                        ? 'bg-indigo-100 ring-2 ring-indigo-400/60 dark:bg-indigo-500/30 dark:ring-indigo-400/50'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {isDone ? (
                    <span aria-hidden className="text-base font-bold leading-none">
                      ✓
                    </span>
                  ) : isLoading ? (
                    <StepSpinner />
                  ) : (
                    <span aria-hidden className="text-lg opacity-60">
                      {step.icon}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`font-semibold transition-colors duration-300 ${
                        isPending ? 'text-slate-500 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {step.name}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold uppercase tracking-wide transition-colors duration-300 ${
                        isDone
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isLoading
                            ? 'text-indigo-700 dark:text-indigo-300'
                            : 'text-slate-500 dark:text-slate-600'
                      }`}
                    >
                      {badgeText}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 transition-colors duration-300 dark:text-slate-500">
                    {step.desc}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500 transition-colors duration-300 dark:text-slate-600">
        Long crawls can take a minute — the last step stays active until completion.
      </p>
    </div>
  );
}
