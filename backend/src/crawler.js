/**
 * crawler.js — Competitor Battleground
 *
 * Depth-2 site crawler:
 *   - Starts from the given URL
 *   - Extracts all internal <a href> links
 *   - Prioritizes: pricing, features, product, about, docs, blog
 *   - Max depth = 2, max pages = 15
 *   - Returns { url, text, hash }[] for each successfully scraped page
 */

import axios      from 'axios';
import * as cheerio from 'cheerio';
import { URL }    from 'url';
import { createHash } from 'crypto';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MAX_PAGES  = 15;
const MAX_DEPTH  = 2;
const FETCH_TIMEOUT_MS = 15_000;
const POLITE_DELAY_MS  = 500;

/** Priority score for a URL path — higher = more valuable */
const PRIORITY_KEYWORDS = [
  'pricing',  'price',    'plans',
  'features', 'feature',  'product', 'products',
  'about',    'about-us', 'company',
  'docs',     'documentation',
  'blog',     'solutions',
  'how-it-works',
];

function urlPriority(href) {
  const lower = href.toLowerCase();
  for (let i = 0; i < PRIORITY_KEYWORDS.length; i++) {
    if (lower.includes(PRIORITY_KEYWORDS[i])) return PRIORITY_KEYWORDS.length - i;
  }
  return 0;
}

/** Fetch raw HTML, returns null on failure */
async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent':      USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout:      FETCH_TIMEOUT_MS,
      maxRedirects: 5,
    });
    // Only handle HTML responses
    const ct = res.headers['content-type'] || '';
    if (!ct.includes('text/html')) return null;
    return res.data;
  } catch (err) {
    console.warn(`[crawler] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

const NOISE_SELECTORS = [
  'script', 'style', 'noscript', 'nav', 'footer', 'header',
  'form', 'svg', 'img', 'iframe', 'aside', '[aria-hidden="true"]',
];

const CONTENT_SELECTORS = [
  'h1', 'h2', 'h3', 'h4', 'p', 'li', 'span', 'td', 'th', 'blockquote',
];

/** Extract clean text from HTML */
function extractText(html) {
  const $ = cheerio.load(html);
  NOISE_SELECTORS.forEach(sel => $(sel).remove());
  const parts = [];
  $(CONTENT_SELECTORS.join(',')).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 30) parts.push(text);
  });
  return [...new Set(parts)].join('\n');
}

/** Extract all internal links from HTML, normalized to absolute URLs */
function extractInternalLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const links = new Set();

  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href');
    if (!raw) return;
    try {
      const resolved = new URL(raw, base);
      // Only same-origin links
      if (resolved.hostname !== base.hostname) return;
      // Strip fragments and query strings for deduplication
      resolved.hash   = '';
      resolved.search = '';
      const href = resolved.href.replace(/\/$/, ''); // strip trailing slash
      if (href && href !== base.origin) links.add(href);
    } catch {
      // skip malformed hrefs
    }
  });

  return [...links];
}

/** SHA-256 hash of text content */
function hashContent(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Crawl a site up to depth=2, returning an array of { url, text, hash }.
 * @param {string} startUrl
 * @param {number} maxDepth  default 2
 * @param {number} maxPages  default 15
 * @returns {Promise<Array<{url: string, text: string, hash: string}>>}
 */
export async function crawlSite(startUrl, maxDepth = MAX_DEPTH, maxPages = MAX_PAGES) {
  const visited = new Set();
  const results = [];

  // Queue entries: { url, depth }
  // Seed with the start URL and the known-priority subpaths
  const origin = new URL(startUrl).origin;

  const seedPaths = [
    '', '/pricing', '/features', '/product', '/products',
    '/about', '/about-us', '/solutions', '/how-it-works',
    '/docs', '/blog',
  ];

  // Build initial queue: start URL first, then seed paths
  const initialQueue = [
    { url: startUrl.replace(/\/$/, ''), depth: 0 },
    ...seedPaths
      .map(p => ({ url: `${origin}${p}`, depth: 0 }))
      .filter(e => e.url !== startUrl.replace(/\/$/, '')),
  ];

  const queue = [...initialQueue];

  console.log(`[crawler] Starting crawl of ${startUrl} (depth=${maxDepth}, maxPages=${maxPages})`);

  while (queue.length > 0 && results.length < maxPages) {
    // Sort queue: lower depth first, then higher priority
    queue.sort((a, b) =>
      a.depth !== b.depth
        ? a.depth - b.depth
        : urlPriority(b.url) - urlPriority(a.url)
    );

    const { url, depth } = queue.shift();

    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchHtml(url);
    if (!html) continue;

    const text = extractText(html);
    if (text.trim().length < 100) {
      console.log(`[crawler] Skipping thin page: ${url}`);
      continue;
    }

    const hash = hashContent(text);
    results.push({ url, text: `[Source: ${url}]\n\n${text}`, hash, rawText: text });
    console.log(`[crawler] ✓ ${url} (depth=${depth}) — ${text.length} chars`);

    // Discover child links at depth+1 (if within limit)
    if (depth < maxDepth) {
      const links = extractInternalLinks(html, url);
      // Sort discovered links by priority before enqueuing
      links.sort((a, b) => urlPriority(b) - urlPriority(a));

      for (const link of links) {
        if (!visited.has(link)) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }

    // Polite crawl delay
    await new Promise(r => setTimeout(r, POLITE_DELAY_MS));
  }

  console.log(`[crawler] Done. Collected ${results.length} pages (visited ${visited.size} URLs).`);
  return results;
}
