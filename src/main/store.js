// Small JSON files under the app's userData folder. Written atomically (temp file +
// rename) so a crash mid-write can't leave a half file behind.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { cleanRecent, pushRecent } from '../shared/recent.js';
import { cleanSavedTabs } from '../shared/session.js';
import { settingsFrom } from '../shared/settings.js';

/** @param {string} name */
const file = (name) => path.join(app.getPath('userData'), name);

/**
 * @param {string} name
 * @param {unknown} fallback
 */
function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * @param {string} name
 * @param {unknown} data
 */
function writeJson(name, data) {
  const target = file(name);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, target);
}

export const store = {
  /** settings.json with neutral defaults; ACC_HUB_URL in the environment overrides the file. */
  settings() {
    return settingsFrom(readJson('settings.json', {}), process.env);
  },

  recent() {
    return cleanRecent(readJson('recent.json', []));
  },

  /** @param {Parameters<typeof pushRecent>[1]} item */
  addRecent(item) {
    const next = pushRecent(store.recent(), item);
    writeJson('recent.json', next);
    return next;
  },

  /** @returns {{ sidebarWidth: number, terminalHeight: number, terminalOpen: boolean, bookmarkSource: string, tabs: string[], activeTab: number }} */
  layout() {
    const d = readJson('layout.json', {});
    return {
      sidebarWidth: Number.isFinite(d.sidebarWidth) ? d.sidebarWidth : 300,
      terminalHeight: Number.isFinite(d.terminalHeight) ? d.terminalHeight : 280,
      terminalOpen: d.terminalOpen !== false,
      bookmarkSource: typeof d.bookmarkSource === 'string' ? d.bookmarkSource : '',
      tabs: cleanSavedTabs(d.tabs),
      activeTab: Number.isInteger(d.activeTab) ? d.activeTab : -1,
    };
  },

  /** @param {Partial<ReturnType<typeof store.layout>>} patch */
  saveLayout(patch) {
    writeJson('layout.json', { ...store.layout(), ...patch });
  },
};
