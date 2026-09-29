// Project Hub client. Runs in the main process, where Node's fetch sends no
// Sec-Fetch-Site header, so Hub's same-origin guard lets it through the same way it
// lets curl through. The renderer never talks to Hub directly.

const HUB = process.env.ACC_HUB_URL || 'http://127.0.0.1:4273';
const TIMEOUT_MS = 30_000; // a cold scan of every workspace takes ~12 s

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
