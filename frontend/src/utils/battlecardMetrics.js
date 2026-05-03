/**
 * Heuristic scores from battlecard prose for chart visualization.
 * Not scientific — gives a comparable dashboard view from text density.
 */

export function isThinContent(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  return t.length < 20 || t.includes('Not enough information found');
}

function densityScore(text) {
  if (isThinContent(text)) return 12;
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split(/\n/).filter((l) => l.trim().length > 0).length;
  let s = 22 + Math.min(words / 6, 42) + Math.min(lines * 2, 24);
  return Math.min(96, Math.round(s));
}

/**
 * @param {Record<string, string>} battlecard
 * @returns {{ subject: string, score: number, fullMark: number }[]}
 */
export function buildRadarSeries(battlecard) {
  return [
    { subject: 'Messaging', score: densityScore(battlecard.positioning), fullMark: 100 },
    { subject: 'Features', score: densityScore(battlecard.features), fullMark: 100 },
    { subject: 'Pricing', score: densityScore(battlecard.pricing), fullMark: 100 },
    { subject: 'Audience', score: densityScore(battlecard.targetAudience), fullMark: 100 },
    { subject: 'Company', score: densityScore(battlecard.companySummary), fullMark: 100 },
  ];
}

/**
 * @param {Record<string, string>} battlecard
 * @returns {{ name: string, value: number, fill: string }[]}
 */
export function buildStrengthWeaknessBars(battlecard) {
  return [
    { name: 'Strengths signal', value: densityScore(battlecard.strengths), fill: '#22c55e' },
    { name: 'Weakness / gap signal', value: densityScore(battlecard.weaknesses), fill: '#f87171' },
  ];
}
