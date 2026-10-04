// The terminal panel: one xterm.js instance per PowerShell session in main.

import { Terminal } from '/vendor/xterm/lib/xterm.mjs';
import { FitAddon } from '/vendor/addon-fit/lib/addon-fit.mjs';

const THEME = {
  background: '#0b0d10', foreground: '#e4e4e7', cursor: '#38bdf8', selectionBackground: '#38bdf855',
  black: '#18181b', red: '#f87171', green: '#34d399', yellow: '#fbbf24', blue: '#60a5fa', magenta: '#c084fc', cyan: '#22d3ee', white: '#e4e4e7',
  brightBlack: '#52525b', brightRed: '#fca5a5', brightGreen: '#6ee7b7', brightYellow: '#fde68a', brightBlue: '#93c5fd', brightMagenta: '#d8b4fe', brightCyan: '#67e8f9', brightWhite: '#fafafa',
};

/** @typedef {{ id: number, term: Terminal, fit: FitAddon, pane: HTMLElement, tab: HTMLElement, exited: boolean }} Session */

export class TerminalPanel {
  /** @param {{ host: HTMLElement, tabs: HTMLElement, api: any }} opts */
  constructor({ host, tabs, api }) {
    this.host = host;
    this.tabsEl = tabs;
    this.api = api;
    /** @type {Map<number, Session>} */
    this.sessions = new Map();
    /** @type {number | null} */
    this.activeId = null;

    api.term.onData((/** @type {number} */ id, /** @type {string} */ data) => this.sessions.get(id)?.term.write(data));
    api.term.onExit((/** @type {number} */ id, /** @type {number} */ code) => {
      const s = this.sessions.get(id);
      if (!s) return;
      s.exited = true;
      s.tab.classList.add('exited');
      s.term.write(`\r\n\x1b[90m[process exited with code ${code}]\x1b[0m\r\n`);
    });

    new ResizeObserver(() => this.fitActive()).observe(host);
  }

  /** @param {string} [cwd] */
  async open(cwd) {
    const term = new Terminal({
      fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: false,
      theme: THEME,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    const pane = document.createElement('div');
    pane.className = 'term-pane';
    this.host.append(pane);
    term.open(pane);
    fit.fit();

    const info = await this.api.term.create({ cwd, cols: term.cols, rows: term.rows });
    const id = /** @type {number} */ (info.id);

    const tab = document.createElement('div');
    tab.className = 'term-tab';
    tab.setAttribute('role', 'tab');
    tab.title = info.cwd;
    tab.innerHTML = '<span class="title"></span><button class="close" aria-label="Close terminal">×</button>';
    /** @type {HTMLElement} */ (tab.querySelector('.title')).textContent = `${info.shell} · ${shortDir(info.cwd)}`;
    tab.addEventListener('click', (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest('.close')) this.close(id);
      else this.activate(id);
    });
    this.tabsEl.append(tab);

    term.onData((data) => this.api.term.write(id, data));
    term.onResize(({ cols, rows }) => this.api.term.resize(id, cols, rows));
    term.onTitleChange((title) => {
      /** @type {HTMLElement} */ (tab.querySelector('.title')).textContent = title.split(/[\\/]/).pop() || title;
    });
    term.attachCustomKeyEventHandler((e) => clipboardKeys(e, term, (text) => this.api.term.write(id, text)));

    this.sessions.set(id, { id, term, fit, pane, tab, exited: false });
    this.activate(id);
    return id;
  }

  /** @param {number} id */
  activate(id) {
    for (const s of this.sessions.values()) {
      const on = s.id === id;
      s.pane.hidden = !on;
      s.tab.classList.toggle('active', on);
      s.tab.setAttribute('aria-selected', String(on));
    }
    this.activeId = id;
    this.fitActive();
    this.sessions.get(id)?.term.focus();
  }

  /** @param {number} id */
  close(id) {
    const s = this.sessions.get(id);
    if (!s) return;
    if (!s.exited) this.api.term.kill(id);
    s.term.dispose();
    s.pane.remove();
    s.tab.remove();
    this.sessions.delete(id);
    if (this.activeId === id) {
      const next = [...this.sessions.keys()].pop();
      this.activeId = null;
      if (next !== undefined) this.activate(next);
    }
  }

  fitActive() {
    const s = this.activeId !== null ? this.sessions.get(this.activeId) : null;
    if (!s || !s.pane.offsetWidth) return;
    try { s.fit.fit(); } catch { /* hidden panel */ }
  }

  /** The terminal a confirmed command goes to: the active one, if it's still running. */
  runTarget() {
    const s = this.activeId !== null ? this.sessions.get(this.activeId) : null;
    if (!s || s.exited) return null;
    return { id: s.id, label: /** @type {HTMLElement} */ (s.tab.querySelector('.title')).textContent || `terminal ${s.id}` };
  }

  focus() {
    const s = this.activeId !== null ? this.sessions.get(this.activeId) : null;
    s?.term.focus();
  }

  get size() { return this.sessions.size; }
}

/** @param {string} dir */
function shortDir(dir) {
  const parts = dir.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join('/') || dir;
}

/**
 * Ctrl+C copies when there's a selection (otherwise it's an interrupt), Ctrl+V and
 * Ctrl+Shift+V paste. Returning false stops xterm handling the key.
 * @param {KeyboardEvent} e
 * @param {Terminal} term
 * @param {(text: string) => void} paste
 */
function clipboardKeys(e, term, paste) {
  if (e.type !== 'keydown' || !e.ctrlKey || e.altKey) return true;
  const key = e.key.toLowerCase();
  if (key === 'c' && term.hasSelection()) {
    navigator.clipboard.writeText(term.getSelection()).catch(() => {});
    term.clearSelection();
    return false;
  }
  if (key === 'v') {
    e.preventDefault();
    navigator.clipboard.readText().then(paste).catch(() => {});
    return false;
  }
  return true;
}
