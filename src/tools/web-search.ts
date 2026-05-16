import { registerTool, type ToolResult } from './registry';
import { getSetting } from '../providers/settings-helper';

const BRAVE_API = 'https://api.search.brave.com/res/v1/web/search';
let lastQueryAt = 0;
const MIN_INTERVAL_MS = 1100;

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastQueryAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastQueryAt = Date.now();
}

registerTool({
  name: 'web_search',
  description: 'Search the web for current information (e.g. latest guidelines, recent papers, news). Uses Brave Search. Results are clearly marked as [web] and include URL, title, and snippet. Requires a Brave Search API key in Settings.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      count: { type: 'number', description: 'Number of results (default 5, max 10)' },
    },
    required: ['query'],
  },
  async execute(args): Promise<ToolResult> {
    const apiKey = await getSetting<string>('api_key_brave');
    if (!apiKey) {
      return { ok: false, content: 'Web search unavailable: add a Brave Search API key in Settings to enable web search.' };
    }
    const query = args.query as string;
    const count = Math.min((args.count as number) ?? 5, 10);

    await throttle();
    try {
      const resp = await fetch(`${BRAVE_API}?q=${encodeURIComponent(query)}&count=${count}`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey,
        },
      });
      if (!resp.ok) {
        const text = await resp.text();
        return { ok: false, content: `Brave Search ${resp.status}: ${text.slice(0, 500)}` };
      }
      const json = await resp.json();
      const results = (json.web?.results ?? []).slice(0, count).map((r: Record<string, unknown>) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
        age: r.age ?? r.page_age ?? null,
      }));
      return { ok: true, content: JSON.stringify({ source: 'web', results }) };
    } catch (e) {
      return { ok: false, content: `Web search failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
});

registerTool({
  name: 'read_url',
  description: 'Fetch a URL and extract its readable text content (HTML stripped, article body extracted). Use after web_search to read the full content of a promising result. Returns text content up to 50KB.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      selector: { type: 'string', description: 'Optional CSS selector to target a specific element' },
    },
    required: ['url'],
  },
  async execute(args): Promise<ToolResult> {
    const url = args.url as string;
    try {
      new URL(url);
    } catch {
      return { ok: false, content: 'Invalid URL' };
    }

    try {
      const resp = await fetch(url);
      if (!resp.ok) return { ok: false, content: `HTTP ${resp.status} ${resp.statusText}` };
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      if (args.selector) {
        const el = doc.querySelector(args.selector as string);
        const text = el?.textContent?.trim() ?? '';
        return { ok: true, content: text.slice(0, 50000) };
      }

      // Strip noisy elements
      doc.querySelectorAll('script, style, noscript, nav, footer, aside, header, iframe').forEach(el => el.remove());

      // Prefer <article>, <main>, then body
      const main = doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body;
      const text = (main?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .trim();
      return { ok: true, content: text.slice(0, 50000) };
    } catch (e) {
      return { ok: false, content: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
});
