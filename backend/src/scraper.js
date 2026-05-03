/**
 * scraper.js — Competitor Battleground
 * Crawls a competitor website: homepage + /pricing + /features
 * Returns an array of { url, text } objects.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const NOISE_SELECTORS = [
  'script', 'style', 'noscript', 'nav', 'footer', 'header',
  'form', 'svg', 'img', 'iframe', 'aside', '[aria-hidden="true"]',
];

const CONTENT_SELECTORS = [
  'h1', 'h2', 'h3', 'h4', 'p', 'li', 'span', 'td', 'th', 'blockquote',
];

/** Fetch HTML with a polite timeout */
async function fetchHtml(url, timeoutMs = 15000) {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: timeoutMs,
      maxRedirects: 5,
    });
    return res.data;
  } catch (err) {
    console.warn(`[scraper] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

/** Strip noise and extract clean text from HTML */
function extractText(html) {
  const $ = cheerio.load(html);

  // Remove noise elements
  NOISE_SELECTORS.forEach(sel => $(sel).remove());

  const parts = [];
  $(CONTENT_SELECTORS.join(',')).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 30) parts.push(text);
  });

  return [...new Set(parts)].join('\n'); // deduplicate identical lines
}

/** Resolve candidate subpage URLs from a base URL */
function buildCandidateUrls(base) {
  const { origin } = new URL(base);
  const subpaths = [
    '', '/pricing', '/features', '/product', '/solutions',
    '/about', '/about-us', '/how-it-works',
  ];
  return subpaths.map(p => `${origin}${p}`);
}

/**
 * Scrape the competitor site.
 * @param {string} startUrl - Root URL entered by user
 * @returns {Promise<Array<{url: string, text: string}>>}
 */
export async function scrapeCompetitorSite(startUrl) {
  const candidates = buildCandidateUrls(startUrl);
  const results = [];

  // Also include the exact URL the user typed (might be a subpage)
  const allUrls = [...new Set([startUrl, ...candidates])];

  for (const url of allUrls) {
    const html = await fetchHtml(url);
    if (!html) continue;

    const text = extractText(html);
    if (text.trim().length > 100) {
      results.push({ url, text: `[Source: ${url}]\n\n${text}` });
      console.log(`[scraper] ✓ ${url} — ${text.length} chars`);
    }

    // Polite delay
    await new Promise(r => setTimeout(r, 600));

    // Stop after 6 successful pages — enough for RAG context
    if (results.length >= 6) break;
  }

  console.log(`[scraper] Done. Collected ${results.length} pages.`);
  return results;
}
