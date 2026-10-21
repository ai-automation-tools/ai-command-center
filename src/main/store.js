// Small JSON files under the app's userData folder. Written atomically (temp file +
// rename) so a crash mid-write can't leave a half file behind.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { cleanMessages } from '../shared/chat.js';
import { cleanRecent, pushRecent } from '../shared/recent.js';
import { settingsFrom } from '../shared/settings.js';
import { chatFileName, cleanWorkspaces } from '../shared/workspaces.js';
import { env } from './env.js';

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
  /** settings.json with neutral defaults; ACC_HUB_URL in .env or the environment overrides the file. */
  settings() {
    return settingsFrom(readJson('settings.json', {}), env);
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

  /** @returns {{ sidebarWidth: number, terminalHeight: number, terminalOpen: boolean, adBlock: boolean, bookmarkSource: string }} */
  layout() {
    const d = readJson('layout.json', {});
    return {
      sidebarWidth: Number.isFinite(d.sidebarWidth) ? d.sidebarWidth : 300,
      terminalHeight: Number.isFinite(d.terminalHeight) ? d.terminalHeight : 280,
      terminalOpen: d.terminalOpen !== false,
      adBlock: d.adBlock !== false,
      bookmarkSource: typeof d.bookmarkSource === 'string' ? d.bookmarkSource : '',
    };
  },

  /** @param {Partial<ReturnType<typeof store.layout>>} patch */
  saveLayout(patch) {
    writeJson('layout.json', { ...store.layout(), ...patch });
  },

  /** workspaces.json; before it exists, a Default workspace holding the tabs layout.json saved. */
  workspaces() {
    const d = readJson('layout.json', {});
    return cleanWorkspaces(readJson('workspaces.json', null), { tabs: d.tabs, activeTab: d.activeTab });
  },

  /** @param {import('../shared/workspaces.js').Workspaces} state */
  saveWorkspaces(state) {
    writeJson('workspaces.json', state);
  },

  /** A workspace's conversation (chat.json for Default), attached page and terminal text included. Empty if the file is missing or malformed. @param {string} ws */
  chat(ws) {
    return cleanMessages(readJson(chatFileName(ws), []));
  },

  /** @param {string} ws @param {import('../shared/chat.js').Message[]} messages */
  saveChat(ws, messages) {
    writeJson(chatFileName(ws), messages);
  },

  /** Clear: the file goes, not just its contents. @param {string} ws */
  clearChat(ws) {
    fs.rmSync(file(chatFileName(ws)), { force: true });
  },
};
