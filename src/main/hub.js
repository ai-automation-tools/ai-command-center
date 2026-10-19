// Project Hub client. Runs in the main process, where Node's fetch sends no
// Sec-Fetch-Site header, so Hub's same-origin guard lets it through the same way it
// lets curl through. The renderer never talks to Hub directly.

import { store } from './store.js';
import { feedSse } from '../shared/events.js';
import { toggleFavorite } from '../shared/favorites.js';

// settings.json's hubUrl, or ACC_HUB_URL (src/shared/settings.js).
const HUB = store.settings().hubUrl;
const TIMEOUT_MS = 30_000; // a cold scan of every workspace takes ~12 s
const RETRY_MS = 3_000; // Hub's /api/events stream advertises retry: 3000

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function hubFetch(path, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(HUB + path, { ...init, signal: ctrl.signal });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => '');
      throw new Error(`Project Hub ${path} returned ${res.status}${text ? `: ${text}` : ''}`);
    }
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error(`Project Hub didn't answer ${path} within ${TIMEOUT_MS / 1000} s`);
    if (err instanceof TypeError) throw new Error(`Project Hub isn't reachable at ${HUB}. Is it running?`);
    throw err;
  }
}

export const hub = {
  url: HUB,

  async health() {
    try {
      const res = await hubFetch('/api/health');
      return /** @type {{ ok: boolean, state: string }} */ (await res.json());
    } catch (err) {
      return { ok: false, state: err instanceof Error ? err.message : String(err) };
    }
  },

  /** @param {boolean} [fresh] */
  async scan(fresh = false) {
    const res = await hubFetch(`/api/scan${fresh ? '?fresh=1' : ''}`);
    const d = await res.json();
    return { base: d.base, home: d.home, tree: d.tree, scannedAt: d.scannedAt, nodes: d.nodes };
  },

  /** Browser bookmarks Hub reads from Chrome, Edge and Brave profiles on disk. */
  /** @param {string} [source] */
  async webmarks(source) {
    const res = await hubFetch(`/api/webmarks${source ? `?source=${encodeURIComponent(source)}` : ''}`);
    return await res.json();
  },

  /** Hub's own favorites (paths and links Mike starred in Hub). */
  async favorites() {
    const res = await hubFetch('/api/favorites');
    return await res.json();
  },

  /**
   * Toggle a web page in Hub's favorites: read the list, add or remove the page, and
   * PUT the whole list back (Hub's endpoint replaces it). Returns the new roots and
   * whether the page is now starred.
   * @param {string} url
   * @param {string} name
   * @returns {Promise<{ starred: boolean, roots: unknown }>}
   */
  async favorite(url, name) {
    const { roots } = await this.favorites();
    const next = toggleFavorite(roots, { url, name });
    await hubFetch('/api/favorites', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roots: next.roots }),
    });
    return next;
  },

  /**
   * A file as HTML, the way Hub's own viewer shows it: Markdown rendered and sanitized
   * by Hub, anything else as an escaped code block. Hub refuses ids outside its roots.
   * @param {string} id
   * @returns {Promise<{ html: string }>}
   */
  async file(id) {
    const res = await hubFetch(`/api/file?${new URLSearchParams({ path: id })}`);
    return await res.json();
  },

  /**
   * Open a node in VS Code, reveal it in Explorer, or open it with its default app.
   * Hub resolves the id against its roots and refuses anything outside them.
   * @param {string} id
   * @param {'code' | 'reveal' | 'default'} how
   */
  async open(id, how) {
    const q = new URLSearchParams({ path: id });
    if (how === 'code') q.set('in', 'code');
    if (how === 'reveal') q.set('reveal', '1');
    await hubFetch(`/api/open?${q}`);
  },
};

/**
 * Subscribe to Hub's `/api/events` server-sent stream, so a rescan the watcher noticed
 * shows up in the app without a manual Retry. The stream is long-lived, so it bypasses
 * hubFetch's 30 s timeout. It reconnects when Hub drops or refuses it, and the returned
 * stop function aborts the stream in flight.
 *
 * @param {() => void} onChange called for each `change` event
 * @returns {() => void} stop
 */
export function subscribeHubEvents(onChange) {
  let stopped = false;
  /** @type {AbortController | null} */
  let controller = null;
  let lastLog = 0;

  (async () => {
    while (!stopped) {
      controller = new AbortController();
      try {
        const res = await fetch(HUB + '/api/events', { signal: controller.signal });
        if (!res.ok || !res.body) throw new Error(`Project Hub /api/events returned ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          const out = feedSse(buffer, decoder.decode(value, { stream: true }));
          buffer = out.buffer;
          for (const e of out.events) if (e.event === 'change') onChange();
        }
      } catch (err) {
        if (stopped) return;
        // Hub may be down at launch (the app runs without it); don't spam every 3 s.
        if (Date.now() - lastLog > 30_000) {
          lastLog = Date.now();
          console.error(`[hub] events stream: ${err instanceof Error ? err.message : err}; reconnecting every ${RETRY_MS / 1000} s`);
        }
      }
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  })();

  return () => {
    stopped = true;
    controller?.abort();
  };
}
