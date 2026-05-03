import { useCallback, useEffect, useRef, useState } from 'react';

/** @typedef {'pending' | 'loading' | 'done'} StepStatus */

/**
 * Maps monotonic pipeline progress (`completedCount`) to per-row status (5-step pipeline).
 * - completedCount === 0 → step 0 loading, rest pending
 * - …
 * - completedCount === 4 → step 4 (“generate”) loading, never “done” until finalizeSuccess()
 * - completedCount >= 5 → all done (after API settles)
 */
export function computeStepStatus(completedCount, index) {
  if (completedCount >= 5) return 'done';
  if (index < completedCount) return 'done';
  if (index === completedCount) return 'loading';
  return 'pending';
}

/** @returns {StepStatus[]} */
export function statusesFromCount(completedCount, length = 5) {
  return Array.from({ length }, (_, i) => computeStepStatus(completedCount, i));
}

/**
 * Progress for /api/analyze: steps 0–3 advance while the HTTP request runs; capped at generating (step 4) loading until axios resolves.
 *
 * @param {{ progressMs?: number, finalDoneMs?: number, fastRemainderMs?: number }} opts
 */
export function useAnalysisProgress(opts = {}) {
  const progressMs      = opts.progressMs ?? 700;
  const finalDoneMs     = opts.finalDoneMs ?? 450;
  const fastRemainderMs = opts.fastRemainderMs ?? 200;

  const [completedCount, setCompletedCount] = useState(0);
  const countRef                             = useRef(0);
  const intervalRef                          = useRef(null);

  useEffect(() => {
    countRef.current = completedCount;
  }, [completedCount]);

  const stopTicker = useCallback(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /** Idle all steps (pending except first waits for start). Reset count to zero. */
  const resetProgress = useCallback(() => {
    stopTicker();
    setCompletedCount(0);
  }, [stopTicker]);

  /**
   * Start / restart pacing: bumps completedCount toward 4 on an interval — never crosses into “generate done”.
   */
  const startProgress = useCallback(() => {
    stopTicker();
    setCompletedCount(0);

    intervalRef.current = setInterval(() => {
      setCompletedCount((c) => {
        if (c >= 4) {
          stopTicker();
          return 4;
        }
        return c + 1;
      });
    }, progressMs);
  }, [progressMs, stopTicker]);

  const cancelProgress = useCallback(() => {
    stopTicker();
  }, [stopTicker]);

  /**
   * After successful axios: stop ticker, optionally fast-forward stages 0–3 if axios finished early,
   * small pause, then flip final step from loading → done.
   */
  const finalizeSuccess = useCallback(async () => {
    stopTicker();

    const start = Math.min(countRef.current, 4);

    for (let k = start; k < 4; k++) {
      await new Promise((r) => setTimeout(r, fastRemainderMs));
      setCompletedCount(k + 1);
    }

    /** UX pause before declaring “Generating Battleground” complete */
    await new Promise((r) => setTimeout(r, finalDoneMs));
    setCompletedCount(5);
  }, [fastRemainderMs, finalDoneMs, stopTicker]);

  return {
    completedCount,
    statuses: statusesFromCount(completedCount),
    startProgress,
    cancelProgress,
    finalizeSuccess,
    resetProgress,
  };
}
