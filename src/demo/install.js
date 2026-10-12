// Demo entry point, loaded before app.js: puts the fake window.acc in place and shows a
// stand-in where the app would draw a browser tab. No network, no storage.

import { demoApi } from './acc.js';

const content = /** @type {HTMLElement} */ (document.getElementById('content'));
const page = document.createElement('div');
page.id = 'demo-page';
page.hidden = true;
page.innerHTML = '<h2></h2><p class="url"></p><p>In the app, this tab is a sandboxed Chromium view with Chrome extension support. The demo has no browser behind it, so the tab strip, the address bar and Recent work, and the page stays this note.</p>';
content.append(page);

/** @param {string} text */
function notify(text) {
  const t = document.createElement('div');
  t.className = 'demo-toast';
  t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), 5000);
}

/** @type {any} */ (window).acc = demoApi({
  notify,
  askAfterMs: 6000,
  onTab(tab) {
    page.hidden = !tab;
    if (!tab) return;
    /** @type {HTMLElement} */ (page.querySelector('h2')).textContent = tab.title;
    /** @type {HTMLElement} */ (page.querySelector('.url')).textContent = tab.url;
  },
});
