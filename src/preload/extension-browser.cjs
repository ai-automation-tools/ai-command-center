// Extension pages and service workers only: point the `browser` namespace at the
// `chrome` object electron-chrome-extensions just filled in. Chromium 144+ exposes
// `browser` as a separate object the library doesn't touch, so an extension that
// prefers it (LastPass, Rakuten) finds no browser.windows and its worker dies on start.
// Registered after the library's preload, so it runs after it.
const { contextBridge } = require('electron');

if (process.type === 'service-worker' || location.href.startsWith('chrome-extension://')) {
  contextBridge.executeInMainWorld({
    func: () => {
      if (typeof chrome !== 'object' || !chrome.runtime?.id || globalThis.browser === chrome) return;
      Object.defineProperty(globalThis, 'browser', { value: chrome, writable: true, enumerable: true, configurable: true });
    },
  });
}
