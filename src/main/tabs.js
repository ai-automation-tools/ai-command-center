// Browser tabs. Each tab is a WebContentsView in the browse session, stacked above
// the shell view and sized to the rectangle the shell renderer reports for the
// content area. Only the active tab is visible.

import { Menu, WebContentsView, clipboard, shell } from 'electron';
import { isAllowedNavigation } from '../shared/url.js';
import { cleanSavedTabs } from '../shared/session.js';

const MAX_CLOSED = 10;

/**
 * @typedef {{ id: number, view: WebContentsView }} Tab
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 */

export class Tabs {
  /**
   * @param {{
   *   window: import('electron').BaseWindow,
   *   session: import('electron').Session,
   *   send: (channel: string, ...args: unknown[]) => void,
   *   onVisit: (url: string, title: string) => void,
   * }} opts
   */
  constructor({ window, session, send, onVisit }) {
    this.window = window;
    this.session = session;
    this.send = send;
    this.onVisit = onVisit;
    /** @type {Map<number, Tab>} */
    this.tabs = new Map();
    /** @type {number | null} */
    this.activeId = null;
    /** @type {Rect} */
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    /** @type {import('electron-chrome-extensions').ElectronChromeExtensions | null} */
    this.extensions = null;
    /** URLs of tabs the user closed, oldest first, for Reopen closed tab. */
    /** @type {string[]} */
    this.closed = [];
  }

  /** @param {import('electron-chrome-extensions').ElectronChromeExtensions} ext */
  attachExtensions(ext) {
    this.extensions = ext;
  }

  /**
   * @param {string} url
   * @param {{ activate?: boolean }} [opts]
   * @returns {Tab}
   */
  create(url, { activate = true } = {}) {
    const view = new WebContentsView({
      webPreferences: {
        session: this.session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const wc = view.webContents;
    const tab = { id: wc.id, view };
    this.tabs.set(tab.id, tab);
    view.setVisible(false);
    this.window.contentView.addChildView(view);
    this.extensions?.addTab(wc, /** @type {any} */ (this.window));

    // Page-initiated, so the page's own URL goes along: a web page can't open acc://doc.
    wc.setWindowOpenHandler(({ url: target }) => {
      if (isAllowedNavigation(target, wc.getURL())) this.create(target);
      return { action: 'deny' };
    });
    wc.on('will-navigate', (e, target) => {
      if (!isAllowedNavigation(target, wc.getURL())) e.preventDefault();
    });
    wc.on('will-redirect', (e, target) => {
      if (!isAllowedNavigation(target, wc.getURL())) e.preventDefault();
    });

    const report = () => this.send('tab:update', this.describe(tab));
    wc.on('page-title-updated', report);
    wc.on('did-start-loading', report);
    wc.on('did-stop-loading', () => {
      report();
      const u = wc.getURL();
      if (/^(https?|file):/i.test(u)) this.onVisit(u, wc.getTitle());
    });
    wc.on('did-navigate', report);
    wc.on('did-navigate-in-page', report);
    wc.on('page-favicon-updated', (_e, favicons) => this.send('tab:update', { ...this.describe(tab), favicon: favicons[0] || '' }));
    wc.on('context-menu', (_e, params) => this.contextMenu(tab, params));
    // Browser shortcuts that the app menu can't own because the terminal needs them.
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown' || !input.control || input.alt || input.shift) return;
      const key = input.key.toLowerCase();
      if (key === 'l') { e.preventDefault(); this.send('shortcut', 'focus-address'); }
      if (key === 'r') { e.preventDefault(); wc.reload(); }
    });
    wc.on('destroyed', () => this.forget(tab.id));

    this.send('tab:created', this.describe(tab));
    wc.loadURL(url).catch(() => { /* surfaced by did-fail-load in the page itself */ });
    if (activate) this.activate(tab.id);
    return tab;
  }

  /** @param {Tab} tab */
  describe(tab) {
    const wc = tab.view.webContents;
    if (!wc || wc.isDestroyed()) return { id: tab.id, url: '', title: '', loading: false, canGoBack: false, canGoForward: false };
    return {
      id: tab.id,
      url: wc.getURL(),
      title: wc.getTitle(),
      loading: wc.isLoading(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
    };
  }

  /** Every open tab, oldest first, for the `list_tabs` MCP tool. */
  list() {
    return [...this.tabs.values()].map((t) => {
      const { id, url, title, loading } = this.describe(t);
      return { id, url, title, loading, active: t.id === this.activeId };
    });
  }

  /** @param {number} id */
  activate(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    for (const t of this.tabs.values()) t.view.setVisible(t.id === id);
    this.activeId = id;
    tab.view.setBounds(this.bounds);
    this.extensions?.selectTab(tab.view.webContents);
    this.send('tab:activated', id);
  }

  /** @param {number} id */
  close(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    // electron-chrome-extensions calls this from the page's 'destroyed' event too,
    // e.g. while the window is closing, when the window is gone and the view's
    // webContents is already undefined.
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(tab.view);
    const wc = tab.view.webContents;
    if (wc && !wc.isDestroyed()) {
      this.closed.push(...cleanSavedTabs([wc.getURL()]));
      this.closed.splice(0, Math.max(0, this.closed.length - MAX_CLOSED));
      wc.close();
    }
    this.forget(id);
  }

  /** Reopen the last tab the user closed, if any. */
  reopen() {
    const url = this.closed.pop();
    if (url) this.create(url);
  }

  /** @param {number} id */
  forget(id) {
    if (!this.tabs.delete(id)) return;
    this.send('tab:closed', id);
    if (this.activeId === id) {
      const next = [...this.tabs.keys()].pop();
      this.activeId = null;
      if (next !== undefined && !this.window.isDestroyed()) this.activate(next);
    }
  }

  /** @param {Rect} rect */
  setBounds(rect) {
    const r = {
      x: Math.round(rect.x), y: Math.round(rect.y),
      width: Math.max(0, Math.round(rect.width)), height: Math.max(0, Math.round(rect.height)),
    };
    this.bounds = r;
    const tab = this.activeId !== null ? this.tabs.get(this.activeId) : null;
    tab?.view.setBounds(r);
  }

  /** Hide the active tab while the shell shows something over the content area. */
  /** @param {boolean} hidden */
  setHidden(hidden) {
    const tab = this.activeId !== null ? this.tabs.get(this.activeId) : null;
    tab?.view.setVisible(!hidden);
  }

  /** URLs of the open tabs in creation order, and the index of the active one. */
  snapshot() {
    const tabs = [...this.tabs.values()];
    return {
      urls: tabs.map((t) => (t.view.webContents && !t.view.webContents.isDestroyed() ? t.view.webContents.getURL() : '')),
      active: tabs.findIndex((t) => t.id === this.activeId),
    };
  }

  active() {
    return this.activeId !== null ? this.tabs.get(this.activeId) ?? null : null;
  }

  /**
   * The visible text of a tab, for read_tab: the one asked for, else the active one.
   * Runs in the page's sandboxed renderer and can't reach anything but the page.
   * @param {number} [id]
   */
  async text(id) {
    const tab = id === undefined ? this.active() : this.tabs.get(id) ?? null;
    if (!tab) throw new Error(id === undefined ? 'No tab is open' : `No tab with id ${id}`);
    const wc = tab.view.webContents;
    const text = await Promise.race([
      wc.executeJavaScript('document.body ? document.body.innerText : ""', false),
      new Promise((_, reject) => setTimeout(() => reject(new Error('The page did not answer within 5 s')), 5000)),
    ]);
    return { id: tab.id, url: wc.getURL(), title: wc.getTitle(), text: String(text ?? '') };
  }

  /** @param {'back' | 'forward' | 'reload' | 'stop' | 'devtools' | 'reopen' | 'zoom-in' | 'zoom-out' | 'zoom-reset'} action */
  command(action) {
    if (action === 'reopen') return this.reopen();
    const wc = this.active()?.view.webContents;
    if (!wc) return;
    // One zoom level is about 20%, like Chrome; zoom is remembered per site by the session.
    if (action === 'zoom-in') wc.setZoomLevel(Math.min(9, wc.getZoomLevel() + 1));
    if (action === 'zoom-out') wc.setZoomLevel(Math.max(-7, wc.getZoomLevel() - 1));
    if (action === 'zoom-reset') wc.setZoomLevel(0);
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    if (action === 'reload') wc.reload();
    if (action === 'stop') wc.stop();
    if (action === 'devtools') wc.toggleDevTools();
  }

  /** @param {string} url */
  navigate(url) {
    if (!isAllowedNavigation(url)) return;
    const tab = this.active();
    if (tab) tab.view.webContents.loadURL(url).catch(() => {});
    else this.create(url);
  }

  /**
   * @param {Tab} tab
   * @param {Electron.ContextMenuParams} params
   */
  contextMenu(tab, params) {
    const wc = tab.view.webContents;
    /** @type {Electron.MenuItemConstructorOptions[]} */
    const items = [];
    if (params.linkURL) {
      items.push(
        { label: 'Open link in new tab', enabled: isAllowedNavigation(params.linkURL, wc.getURL()), click: () => this.create(params.linkURL, { activate: false }) },
        // http and https only: openExternal on file: or ms-*: links would launch programs.
        { label: 'Open link in default browser', enabled: /^https?:/i.test(params.linkURL), click: () => shell.openExternal(params.linkURL) },
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }
    if (params.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' });
    else if (params.selectionText) items.push({ role: 'copy' }, { type: 'separator' });
    items.push(
      { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Reload', click: () => wc.reload() },
    );
    const extItems = this.extensions?.getContextMenuItems(wc, params) ?? [];
    if (extItems.length) items.push({ type: 'separator' }, ...extItems);
    items.push({ type: 'separator' }, { label: 'Inspect', click: () => wc.inspectElement(params.x, params.y) });
    Menu.buildFromTemplate(items).popup();
  }
}
