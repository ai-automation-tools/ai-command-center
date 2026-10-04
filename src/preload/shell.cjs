// Preload for the shell UI only. Exposes a fixed set of calls on window.acc; browser
// tabs get no preload from this app, so pages on the web never see any of this.

const { contextBridge, ipcRenderer } = require('electron');
const { injectBrowserAction } = require('electron-chrome-extensions/browser-action');

if (location.protocol === 'acc:' && location.host === 'shell') {
  injectBrowserAction();
}

/** @param {string} channel */
const invoke = (channel) => (/** @type {unknown[]} */ ...args) => ipcRenderer.invoke(channel, ...args);

/** @param {string} channel */
const listen = (channel) => (/** @type {(...args: any[]) => void} */ fn) => {
  /** @param {unknown} _e @param {unknown[]} args */
  const handler = (_e, ...args) => fn(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('acc', {
  info: invoke('app:info'),
  saveLayout: invoke('layout:save'),

  hub: {
    health: invoke('hub:health'),
    scan: invoke('hub:scan'),
    webmarks: invoke('hub:webmarks'),
    favorites: invoke('hub:favorites'),
    open: invoke('hub:open'),
  },

  tabs: {
    create: invoke('tabs:create'),
    activate: invoke('tabs:activate'),
    close: invoke('tabs:close'),
    navigate: invoke('tabs:navigate'),
    command: invoke('tabs:command'),
    openExternal: invoke('tabs:openExternal'),
    restore: invoke('tabs:restore'),
    /** @param {{ x: number, y: number, width: number, height: number }} rect */
    setBounds: (rect) => ipcRenderer.send('tabs:bounds', rect),
    /** @param {boolean} hidden */
    setHidden: (hidden) => ipcRenderer.send('tabs:hidden', hidden),
    onCreated: listen('tab:created'),
    onUpdate: listen('tab:update'),
    onActivated: listen('tab:activated'),
    onClosed: listen('tab:closed'),
  },

  term: {
    create: invoke('term:create'),
    kill: invoke('term:kill'),
    /** @param {number} id @param {string} data */
    write: (id, data) => ipcRenderer.send('term:write', id, data),
    /** @param {number} id @param {number} cols @param {number} rows */
    resize: (id, cols, rows) => ipcRenderer.send('term:resize', id, cols, rows),
    onData: listen('term:data'),
    onExit: listen('term:exit'),
  },

  recent: {
    list: invoke('recent:list'),
    add: invoke('recent:add'),
    onChanged: listen('recent:changed'),
  },

  mcp: {
    answer: invoke('mcp:answer'),
    onConfirm: listen('mcp:confirm'),
    onCancel: listen('mcp:cancel'),
  },

  extensions: { list: invoke('ext:list') },
  onShortcut: listen('shortcut'),
});
