// Named workspaces, saved in workspaces.json: a Project Hub folder plus the tabs, the
// terminal folders and the conversation that go with it. Pure; the main process owns
// the file (src/main/store.js) and does the switching (src/main/main.js).

import { cleanSavedTabs } from './session.js';

export const WORKSPACES_VERSION = 1;
export const DEFAULT_ID = 'default';
export const WORKSPACES_MAX = 30;
export const TERMINALS_MAX = 8;

/**
 * @typedef {{ id: string, name: string, folder: string, hubId: string, tabs: string[], activeTab: number, terminals: string[] }} Workspace
 * @typedef {{ version: number, active: string, list: Workspace[] }} Workspaces
 */

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const HIDDEN_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;

/** An absolute folder on a drive, like D:\work\app or D:/work/app; '' for anything else. @param {unknown} v */
export function drivePath(v) {
  return typeof v === 'string' && /^[A-Za-z]:[\\/]/.test(v) && v.length <= 1000 && !HIDDEN_CHARS.test(v) ? v : '';
}

/** @param {unknown} v @param {number} max */
const text = (v, max) => (typeof v === 'string' ? v.replace(HIDDEN_CHARS, '').trim().slice(0, max) : '');

/** @param {Partial<Workspace>} w @returns {Workspace} */
function blank(w) {
  return { id: DEFAULT_ID, name: 'Default', folder: '', hubId: '', tabs: [], activeTab: -1, terminals: [], ...w };
}

/**
 * Read workspaces.json, which the user can edit, so trust nothing. There is always a
 * Default workspace first; before the file exists it takes the tabs layout.json saved.
 * @param {unknown} raw
 * @param {{ tabs?: string[], activeTab?: number }} [legacy] layout.json's tabs, for the first run
 * @returns {Workspaces}
 */
export function cleanWorkspaces(raw, legacy = {}) {
  const d = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : null;
  const items = d && Array.isArray(d.list) ? d.list : [];
  /** @type {Workspace[]} */
  const list = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || list.length >= WORKSPACES_MAX) continue;
    const id = typeof item.id === 'string' && ID.test(item.id) ? item.id : '';
    if (!id || list.some((w) => w.id === id)) continue;
    const folder = drivePath(item.folder);
    if (id !== DEFAULT_ID && !folder) continue;
    list.push(blank({
      id,
      name: text(item.name, 80) || (id === DEFAULT_ID ? 'Default' : id),
      folder: id === DEFAULT_ID ? '' : folder,
      hubId: id === DEFAULT_ID ? '' : text(item.hubId, 1000),
      tabs: cleanSavedTabs(item.tabs),
      activeTab: Number.isInteger(item.activeTab) ? item.activeTab : -1,
      terminals: cleanFolders(item.terminals),
    }));
  }
  const def = list.findIndex((w) => w.id === DEFAULT_ID);
  if (def < 0) {
    const first = d ? {} : { tabs: cleanSavedTabs(legacy.tabs), activeTab: Number.isInteger(legacy.activeTab) ? /** @type {number} */ (legacy.activeTab) : -1 };
    list.unshift(blank(first));
  } else if (def > 0) {
    list.unshift(...list.splice(def, 1));
  }
  const active = d && list.some((w) => w.id === d.active) ? /** @type {string} */ (d.active) : DEFAULT_ID;
  return { version: WORKSPACES_VERSION, active, list };
}

/** @param {unknown} raw */
export function cleanFolders(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(drivePath).filter(Boolean).slice(0, TERMINALS_MAX);
}

/**
 * Add a workspace for a folder, or find the one that already has it. Its id comes from
 * the name, made unique.
 * @param {Workspaces} state
 * @param {{ name: unknown, folder: unknown, hubId?: unknown }} input
 * @returns {{ state: Workspaces, id: string }}
 */
export function addWorkspace(state, { name, folder, hubId }) {
  const dir = drivePath(folder);
  if (!dir) throw new Error('A workspace needs an absolute folder on a drive');
  const same = (/** @type {string} */ a) => a.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
  const existing = state.list.find((w) => w.folder && same(w.folder) === same(dir));
  if (existing) return { state, id: existing.id };
  if (state.list.length >= WORKSPACES_MAX) throw new Error(`At most ${WORKSPACES_MAX} workspaces`);
  const label = text(name, 80) || dir.split(/[\\/]/).filter(Boolean).pop() || dir;
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'workspace';
  let id = base === DEFAULT_ID ? `${base}-2` : base;
  for (let n = 2; state.list.some((w) => w.id === id); n++) id = `${base}-${n}`;
  const ws = blank({ id, name: label, folder: dir, hubId: text(hubId, 1000), terminals: [dir] });
  return { state: { ...state, list: [...state.list, ws] }, id };
}

/**
 * Remove a workspace; Default can't go. Removing the active one makes Default active.
 * @param {Workspaces} state
 * @param {string} id
 * @returns {Workspaces}
 */
export function removeWorkspace(state, id) {
  if (id === DEFAULT_ID) throw new Error("The Default workspace can't be removed");
  const list = state.list.filter((w) => w.id !== id);
  return { ...state, list, active: state.active === id ? DEFAULT_ID : state.active };
}

/**
 * Replace one workspace's saved tabs and terminal folders, leaving the rest alone.
 * @param {Workspaces} state
 * @param {string} id
 * @param {{ tabs?: string[], activeTab?: number, terminals?: string[] }} patch
 * @returns {Workspaces}
 */
export function saveWorkspace(state, id, patch) {
  return {
    ...state,
    list: state.list.map((w) => (w.id !== id ? w : {
      ...w,
      ...(patch.tabs ? { tabs: cleanSavedTabs(patch.tabs), activeTab: patch.activeTab ?? -1 } : {}),
      ...(patch.terminals ? { terminals: cleanFolders([...new Set(patch.terminals)]) } : {}),
    })),
  };
}

/** The file a workspace's conversation lives in; Default keeps the chat.json it always had. @param {string} id */
export function chatFileName(id) {
  if (!ID.test(id)) throw new Error(`not a workspace id: ${id}`);
  return id === DEFAULT_ID ? 'chat.json' : `chat-${id}.json`;
}

/** What the shell needs: names and folders, never the saved tab lists. @param {Workspaces} state */
export function workspaceSummary(state) {
  return {
    active: state.active,
    list: state.list.map(({ id, name, folder, hubId }) => ({ id, name, folder, hubId })),
  };
}
