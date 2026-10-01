// The Control Center's MCP tools. The read-only ones look at the open tabs, the
// sidebar's search and the Recent list; the navigation ones open a tab or a file.
// Pure: main.js hands in the data sources and actions, so the tests run every tool
// against fakes.

import { absPath, flatten, flattenBookmarks, searchAll } from './tree.js';
import { toUrl } from './url.js';

const MAX_LIMIT = 100;
const MAX_QUERY = 500;
const MAX_URL = 8192;
const MAX_ID = 1024;
const RECENT_TYPES = ['file', 'folder', 'url', 'terminal'];
// Not 'default': opening a file with its default app would run a .ps1 or .exe
// without the click that terminal_run asks for.
const OPEN_IN = ['code', 'reveal'];

/**
 * @typedef {import('./mcp.js').Tool} Tool
 * @typedef {import('./recent.js').RecentItem} RecentItem
 * @typedef {{ id: number, url: string, title: string, loading: boolean, active: boolean }} TabInfo
 * @typedef {{
 *   listTabs: () => TabInfo[],
 *   scan: () => Promise<{ base: string, home: string, tree: import('./tree.js').HubNode[] }>,
 *   bookmarks: () => Promise<{ roots?: any[] }>,
 *   recent: () => RecentItem[],
 *   openTab: (url: string, activate: boolean) => { id: number },
 *   openFile: (id: string, how: 'code' | 'reveal') => Promise<void>,
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

/**
 * Address-bar text for an agent's new tab, as a URL. Only web pages and local files:
 * extension pages and about: pages stay the user's to open.
 * @param {unknown} value
 */
export function tabUrlArg(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_URL) {
    throw new Error(`url must be a non-empty string of at most ${MAX_URL} characters`);
  }
  const url = toUrl(value);
  if (!/^(https?|file):/i.test(url)) throw new Error('open_tab opens http, https and file URLs only');
  return url;
}

/**
 * A Project Hub node id as sidebar_search returns it. Hub resolves ids against its own
 * roots and refuses the rest; this refuses the obvious escapes before they get there.
 * @param {unknown} value
 */
export function hubIdArg(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_ID
    || /\p{Cc}/u.test(value) || value.startsWith('@') || /^([a-z]:|[\\/])/i.test(value)
    || value.split(/[\\/]/).includes('..')) {
    throw new Error('id must be a Project Hub node id from sidebar_search, such as "app/docs/guide.md"');
  }
  return value;
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

/**
 * @param {Sources} src
 * @returns {Map<string, Tool>}
 */
export function navigationTools(src) {
  return new Map([
    ['open_tab', {
      description: 'Open a browser tab in AI Command Center. Takes what the address bar takes: a URL, a Windows path, localhost:<port>, a host name, or words to search for. http, https and file pages only.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', minLength: 1, maxLength: MAX_URL },
          background: { type: 'boolean', description: 'Open without switching to it (default false)' },
        },
        required: ['url'],
        additionalProperties: false,
      },
      run: (/** @type {any} */ args) => {
        const url = tabUrlArg(args.url);
        if (args.background !== undefined && typeof args.background !== 'boolean') throw new Error('background must be true or false');
        return { id: src.openTab(url, !args.background).id, url };
      },
    }],
    ['open_file', {
      description: "Open a file or folder from Project Hub's tree in VS Code, or reveal it in Explorer. Takes the node id that sidebar_search returns, not a path. To view an HTML file in the app, use open_tab with its path instead.",
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1, maxLength: MAX_ID, description: 'Node id from sidebar_search' },
          in: { type: 'string', enum: OPEN_IN, description: 'code (default) or reveal' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      run: async (/** @type {any} */ args) => {
        const id = hubIdArg(args.id);
        const how = args.in ?? 'code';
        if (!OPEN_IN.includes(how)) throw new Error(`in must be one of ${OPEN_IN.join(', ')}`);
        await src.openFile(id, how);
        return { opened: id, in: how };
      },
    }],
  ]);
}
