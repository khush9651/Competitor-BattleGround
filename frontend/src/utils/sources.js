/** Normalize API sources: structured objects or legacy string URLs */
export function normalizeStructuredSources(sources) {
  if (!sources?.length) return [];
  const first = sources[0];
  if (typeof first === 'string') {
    return sources.map(url => ({
      text: '',
      url,
      score: 0,
    }));
  }
  return sources.filter(s => s && (s.url || s.text));
}
