// Chrome extension support for the browse session: electron-chrome-extensions for the
// chrome.* APIs, electron-chrome-web-store so the Web Store's "Add to Chrome" button
// installs into this app. See docs/decisions/adr-001-electron-shell.md for the licence
// choice and what's known not to work.

import { ElectronChromeExtensions } from 'electron-chrome-extensions';
import { installChromeWebStore, updateExtensions } from 'electron-chrome-web-store';

/**
 * @param {{
 *   browseSession: import('electron').Session,
 *   shellSession: import('electron').Session,
 *   window: import('electron').BaseWindow,
 *   tabs: import('./tabs.js').Tabs,
 * }} opts
 */
export async function setupExtensions({ browseSession, shellSession, window, tabs }) {
  const extensions = new ElectronChromeExtensions({
    // Personal, unpublished tool: GPL-3.0 terms apply. Anything distributed later needs
    // either a GPL-compatible licence for this repo or the patron licence.
    license: 'GPL-3.0',
    session: browseSession,
    async createTab(details) {
      const tab = tabs.create(details.url || 'about:blank', { activate: details.active !== false });
      return [tab.view.webContents, /** @type {any} */ (window)];
    },
    selectTab(wc) {
      tabs.activate(wc.id);
    },
    removeTab(wc) {
      tabs.close(wc.id);
    },
    async createWindow(details) {
      // One window by design: extension "windows" open as tabs.
      const urls = Array.isArray(details.url) ? details.url : [details.url || 'about:blank'];
      for (const u of urls) tabs.create(u);
      return /** @type {any} */ (window);
    },
  });
  tabs.attachExtensions(extensions);

  // The shell's <browser-action-list> loads extension icons over crx://.
  ElectronChromeExtensions.handleCRXProtocol(shellSession);

  // Loads everything previously installed from the Web Store, and makes the store's
  // install button work inside a tab.
  await installChromeWebStore({ session: browseSession });
  updateExtensions(browseSession).catch((err) => console.error('[extensions] update check failed:', err));

  return extensions;
}

/** @param {import('electron').Session} browseSession */
export function listExtensions(browseSession) {
  return browseSession.extensions.getAllExtensions().map((e) => ({ id: e.id, name: e.name, version: e.version }));
}
