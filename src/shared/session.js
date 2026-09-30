// The browser tabs saved in layout.json so they reopen after a restart. Pure; the main
// process owns persistence (src/main/store.js) and the tabs themselves (src/main/tabs.js).

import { isAllowedNavigation } from './url.js';

export const SAVED_TABS_MAX = 30;

/**
 * Keep only URLs worth reopening: allowed schemes, no blank pages, capped. The file on
 * disk is user-editable, so trust nothing.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function cleanSavedTabs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u) => typeof u === 'string' && u !== '' && !/^about:/i.test(u) && isAllowedNavigation(u))
    .slice(0, SAVED_TABS_MAX);
}

/**
 * Which saved tab to activate: the stored index if it still points at a tab, else the last.
 * @param {unknown} index
 * @param {number} count
 * @returns {number}
 */
export function savedActiveIndex(index, count) {
  return Number.isInteger(index) && /** @type {number} */ (index) >= 0 && /** @type {number} */ (index) < count
    ? /** @type {number} */ (index)
    : count - 1;
}
