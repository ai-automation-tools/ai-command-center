// The Control Center's MCP tools. The read-only ones so far: they look at the open
// tabs, the sidebar's search and the Recent list, and change nothing. Pure: main.js
// hands in the data sources, so the tests run every tool against fakes.

import { absPath, flatten, flattenBookmarks, searchAll } from './tree.js';

const MAX_LIMIT = 100;
const MAX_QUERY = 500;
const RECENT_TYPES = ['file', 'folder', 'url', 'terminal'];

/**
 * @typedef {import('./mcp.js').Tool} Tool
 * @typedef {import('./recent.js').RecentItem} RecentItem
 * @typedef {{ id: number, url: string, title: string, loading: boolean, active: boolean }} TabInfo
 * @typedef {{
 *   listTabs: () => TabInfo[],
 *   scan: () => Promise<{ base: string, home: string, tree: import('./tree.js').HubNode[] }>,
 *   bookmarks: () => Promise<{ roots?: any[] }>,
 *   recent: () => RecentItem[],
 * }} Sources
 */

/**
 * An optional whole-number limit, 1 to 100. Anything else is the caller's mistake.
 * @param {unknown} value
 * @param {number} fallback
 */
export function limitArg(value, fallback) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || /** @type {number} */ (value) < 1 || /** @type {number} */ (value) > MAX_LIMIT) {
    throw new Error(`limit must be a whole number from 1 to ${MAX_LIMIT}`);
  }
  return /** @type {number} */ (value);
}

/** @param {unknown} err */
const message = (err) => (err instanceof Error ? err.message : String(err));

/**
 * @param {Sources} src
 * @returns {Map<string, Tool>}
 */
export function readOnlyTools(src) {
  const limitSchema = { type: 'integer', minimum: 1, maximum: MAX_LIMIT };
  return new Map([
    ['list_tabs', {
      description: 'List the browser tabs open in AI Command Center: id, URL, title, whether it is loading, and which one is active.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: () => ({ tabs: src.listTabs() }),
    }],
    ['sidebar_search', {
      description: "Search the sidebar the way its search box does: Project Hub's file tree, the bookmarks source picked in the sidebar, and the Recent list. Every word must match; file name matches rank first.",
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', minLength: 1, maxLength: MAX_QUERY }, limit: { ...limitSchema, description: 'Most results per group (default 20)' } },
        required: ['query'],
        additionalProperties: false,
      },
      run: async (/** @type {any} */ args) => {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query || query.length > MAX_QUERY) throw new Error(`query must be a non-empty string of at most ${MAX_QUERY} characters`);
        const limit = limitArg(args.limit, 20);
        // One source failing (Hub down, say) shouldn't hide what the others found.
        /** @type {string[]} */
        const errors = [];
        const [scan, marks] = await Promise.all([
          src.scan().catch((err) => { errors.push(`files: ${message(err)}`); return null; }),
          src.bookmarks().catch((err) => { errors.push(`bookmarks: ${message(err)}`); return null; }),
        ]);
        const hits = searchAll({
          files: scan ? flatten(scan.tree || []) : [],
          bookmarks: marks ? flattenBookmarks(marks.roots || []) : [],
          recent: src.recent(),
        }, query, { files: limit, bookmarks: limit, recent: limit });
        return {
          files: hits.files.map(({ node, path }) => ({
            id: node.id, name: node.name, kind: node.kind, path: scan ? absPath(node.id, scan) : null, trail: path,
          })),
          bookmarks: hits.bookmarks.map((b) => ({ name: b.name, url: b.url, folder: b.path })),
          recent: hits.recent,
          errors,
        };
      },
    }],
    ['recent', {
      description: 'The Recent list, newest first: files, folders, pages and terminal sessions opened in the app, with when (ms since epoch).',
      inputSchema: {
        type: 'object',
        properties: { type: { type: 'string', enum: RECENT_TYPES }, limit: { ...limitSchema, description: 'Most items to return (default 20)' } },
        additionalProperties: false,
      },
      run: (/** @type {any} */ args) => {
        if (args.type !== undefined && !RECENT_TYPES.includes(args.type)) throw new Error(`type must be one of ${RECENT_TYPES.join(', ')}`);
        const limit = limitArg(args.limit, 20);
        return { items: src.recent().filter((r) => !args.type || r.type === args.type).slice(0, limit) };
      },
    }],
  ]);
}
