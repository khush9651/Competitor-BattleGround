/**
 * Minimum spacing between AI requests per client IP (reduces abusive retries / bursts).
 */

const DEFAULT_MS = 12_000;

function clientKey(req) {
  const fwd = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
    : '';
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

const lastSeen = new Map();

function cooldownMs() {
  const raw = parseInt(process.env.LLM_CLIENT_COOLDOWN_MS || String(DEFAULT_MS), 10);
  if (!Number.isFinite(raw) || raw < 1000 || raw > 120_000) return DEFAULT_MS;
  return raw;
}

/**
 * Express middleware — run on /api/analyze, /api/ask, /api/match BEFORE heavy work.
 * Records timestamp at admit time so rapid double-clicks queue behind cooldown.
 */
export function llmCooldown(req, res, next) {
  const key = clientKey(req);
  const now = Date.now();
  const windowMs = cooldownMs();
  const prev = lastSeen.get(key) || 0;
  const elapsed = now - prev;

  if (prev > 0 && elapsed < windowMs) {
    const waitSec = Math.ceil((windowMs - elapsed) / 1000);
    return res.status(429).json({
      error: `Please wait ${waitSec}s before another AI request.`,
    });
  }

  lastSeen.set(key, now);
  next();
}
