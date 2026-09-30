// Shell UI entry point: wires the sidebar, the browser tab strip and address bar, and
// the terminal panel, and keeps the main process told where the browser pane sits.

import { Sidebar, toast } from '/sidebar.js';
import { TerminalPanel } from '/terminal.js';

/** @type {any} */
const api = /** @type {any} */ (window).acc;
const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

const QUICK_LINKS = [
  ['Project Hub', 'http://127.0.0.1:4273'],
  ['AI Library', 'https://library.mikesailab.com'],
  ['mikesailab.com', 'https://mikesailab.com'],
  ['Chrome Web Store', 'https://chromewebstore.google.com'],
];

const info = await api.info();
const layout = info.layout;
const appEl = $('app');
const mainEl = $('main');
const content = $('content');
const address = /** @type {HTMLInputElement} */ ($('address'));

// ---- layout ----------------------------------------------------------------

document.documentElement.style.setProperty('--sidebar-w', `${layout.sidebarWidth}px`);
document.documentElement.style.setProperty('--term-h', `${layout.terminalHeight}px`);
mainEl.classList.toggle('no-terminal', !layout.terminalOpen);

function reportBounds() {
  const r = content.getBoundingClientRect();
  api.tabs.setBounds({ x: r.left, y: r.top, width: r.width, height: r.height });
}
new ResizeObserver(reportBounds).observe(content);
window.addEventListener('resize', reportBounds);

/**
 * Drag a splitter. The browser pane is a separate view that swallows mouse events, so
 * it's hidden for the length of the drag.
 * @param {HTMLElement} handle
 * @param {(e: PointerEvent) => void} move
 * @param {() => void} done
 */
function dragSplitter(handle, move, done) {
  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    api.tabs.setHidden(true);
    const onMove = (/** @type {PointerEvent} */ ev) => move(ev);
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      api.tabs.setHidden(false);
      reportBounds();
      terminals.fitActive();
      done();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp, { once: true });
  });
}

dragSplitter($('side-split'), (e) => {
  layout.sidebarWidth = Math.min(600, Math.max(200, e.clientX));
  document.documentElement.style.setProperty('--sidebar-w', `${layout.sidebarWidth}px`);
}, () => api.saveLayout({ sidebarWidth: layout.sidebarWidth }));

dragSplitter($('term-split'), (e) => {
  layout.terminalHeight = Math.min(window.innerHeight - 200, Math.max(120, window.innerHeight - e.clientY));
  document.documentElement.style.setProperty('--term-h', `${layout.terminalHeight}px`);
}, () => api.saveLayout({ terminalHeight: layout.terminalHeight }));

// ---- terminals ---------------------------------------------------------------

const terminals = new TerminalPanel({ host: $('term-host'), tabs: $('term-tabs'), api });

/** @param {boolean} open */
function setTerminalOpen(open) {
  mainEl.classList.toggle('no-terminal', !open);
  layout.terminalOpen = open;
  api.saveLayout({ terminalOpen: open });
  requestAnimationFrame(() => { reportBounds(); terminals.fitActive(); });
}

/** @param {string} [cwd] */
async function openTerminal(cwd) {
  setTerminalOpen(true);
  try {
    await terminals.open(cwd);
  } catch (err) {
    toast(`Couldn't start a terminal: ${err instanceof Error ? err.message : err}`);
  }
}

$('term-new').addEventListener('click', () => openTerminal());
$('term-toggle').addEventListener('click', () => setTerminalOpen(false));

// ---- browser tabs ------------------------------------------------------------

// Extension toolbar buttons (LastPass, Rakuten, …) from electron-chrome-extensions.
/** @type {HTMLElement | null} */
let actions = null;
if (customElements.get('browser-action-list')) {
  actions = document.createElement('browser-action-list');
  actions.setAttribute('partition', info.browsePartition);
  actions.setAttribute('alignment', 'bottom left');
  $('actions-host').append(actions);
}

/** @type {Map<number, HTMLElement>} */
const tabEls = new Map();
/** @type {Map<number, { url: string, title: string, loading: boolean, canGoBack: boolean, canGoForward: boolean }>} */
const tabState = new Map();
/** @type {number | null} */
let activeTab = null;

/** @param {string} url @param {{ background?: boolean }} [opts] */
async function openUrl(url, opts = {}) {
  const prev = activeTab;
  const id = await api.tabs.create(url);
  if (opts.background && prev !== null) api.tabs.activate(prev);
  return id;
}

api.tabs.onCreated((/** @type {any} */ t) => {
  const el = document.createElement('div');
  el.className = 'tab';
  el.setAttribute('role', 'tab');
  el.innerHTML = '<img alt="" hidden><span class="title">New tab</span><button class="close" aria-label="Close tab">×</button>';
  el.addEventListener('click', (e) => {
    if (/** @type {HTMLElement} */ (e.target).closest('.close')) api.tabs.close(t.id);
    else api.tabs.activate(t.id);
  });
  el.addEventListener('auxclick', (e) => { if (e.button === 1) api.tabs.close(t.id); });
  $('tab-list').append(el);
  tabEls.set(t.id, el);
  updateTab(t);
  $('empty').hidden = true;
});

api.tabs.onUpdate(updateTab);

/** @param {any} t */
function updateTab(t) {
  const el = tabEls.get(t.id);
  if (!el) return;
  tabState.set(t.id, { ...(tabState.get(t.id) || {}), ...t });
  const title = t.title || t.url || 'New tab';
  /** @type {HTMLElement} */ (el.querySelector('.title')).textContent = title;
  el.title = `${title}\n${t.url}`;
  el.classList.toggle('loading', Boolean(t.loading));
  if (t.favicon !== undefined) {
    const img = /** @type {HTMLImageElement} */ (el.querySelector('img'));
    img.hidden = !t.favicon;
    if (t.favicon) img.src = t.favicon;
  }
  if (t.id === activeTab) syncNavbar();
}

api.tabs.onActivated((/** @type {number} */ id) => {
  activeTab = id;
  for (const [tid, el] of tabEls) {
    el.classList.toggle('active', tid === id);
    el.setAttribute('aria-selected', String(tid === id));
  }
  tabEls.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  actions?.setAttribute('tab', String(id));
  syncNavbar();
});

api.tabs.onClosed((/** @type {number} */ id) => {
  tabEls.get(id)?.remove();
  tabEls.delete(id);
  tabState.delete(id);
  if (activeTab === id) activeTab = null;
  if (!tabEls.size) {
    $('empty').hidden = false;
    address.value = '';
    syncNavbar();
  }
});

function syncNavbar() {
  const s = activeTab !== null ? tabState.get(activeTab) : null;
  if (document.activeElement !== address) address.value = s?.url && s.url !== 'about:blank' ? s.url : '';
  /** @type {HTMLButtonElement} */ (document.querySelector('[data-cmd="back"]')).disabled = !s?.canGoBack;
  /** @type {HTMLButtonElement} */ (document.querySelector('[data-cmd="forward"]')).disabled = !s?.canGoForward;
}

$('address-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = address.value.trim();
  if (!text) return;
  if (activeTab === null) api.tabs.create(text);
  else api.tabs.navigate(text);
  address.blur();
});
address.addEventListener('focus', () => address.select());
for (const btn of document.querySelectorAll('[data-cmd]')) {
  btn.addEventListener('click', () => api.tabs.command(/** @type {HTMLElement} */ (btn).dataset.cmd));
}
$('new-tab').addEventListener('click', newTab);
$('open-external').addEventListener('click', () => {
  const s = activeTab !== null ? tabState.get(activeTab) : null;
  if (s?.url) api.tabs.openExternal(s.url);
});

function newTab() {
  address.value = '';
  address.focus();
  activeTab = null;
  for (const el of tabEls.values()) el.classList.remove('active');
  api.tabs.setHidden(true);
  $('empty').hidden = false;
}
address.addEventListener('blur', () => {
  // Leaving the address bar without navigating returns to the tab that was showing.
  setTimeout(() => {
    if (activeTab === null && tabEls.size && document.activeElement !== address) {
      api.tabs.activate([...tabEls.keys()].pop());
      $('empty').hidden = true;
    }
  }, 150);
});

for (const [label, url] of QUICK_LINKS) {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = url;
  b.addEventListener('click', () => openUrl(url));
  $('quick-links').append(b);
}

// ---- sidebar -----------------------------------------------------------------

const sidebar = new Sidebar({ api, layout, openUrl, openTerminal: (cwd) => openTerminal(cwd) });

// ---- shortcuts ---------------------------------------------------------------

api.onShortcut((/** @type {string} */ action) => {
  if (action === 'new-tab') newTab();
  if (action === 'close-tab' && activeTab !== null) api.tabs.close(activeTab);
  if (action === 'focus-address') address.focus();
  if (action === 'toggle-terminal') {
    const open = mainEl.classList.contains('no-terminal');
    setTerminalOpen(open);
    if (open && !terminals.size) openTerminal();
    else if (open) terminals.focus();
  }
  if (action === 'new-terminal') openTerminal();
  if (action === 'focus-search') {
    appEl.classList.remove('no-sidebar');
    sidebar.focusSearch();
  }
  if (action === 'toggle-sidebar') {
    appEl.classList.toggle('no-sidebar');
    requestAnimationFrame(reportBounds);
  }
  if (action === 'reload') api.tabs.command('reload');
  if (action === 'devtools') api.tabs.command('devtools');
});

// ---- start -------------------------------------------------------------------

reportBounds();
api.tabs.restore();
if (layout.terminalOpen) openTerminal();
sidebar.load();
