// The terminal panel: one xterm.js instance per shell session in main.

import { Terminal } from './vendor/xterm/lib/xterm.mjs';
import { FitAddon } from './vendor/addon-fit/lib/addon-fit.mjs';
import { findLinks } from './shared/links.js';

const THEME = {
  background: '#0b0d10', foreground: '#e4e4e7', cursor: '#38bdf8', selectionBackground: '#38bdf855',
  black: '#18181b', red: '#f87171', green: '#34d399', yellow: '#fbbf24', blue: '#60a5fa', magenta: '#c084fc', cyan: '#22d3ee', white: '#e4e4e7',
  brightBlack: '#52525b', brightRed: '#fca5a5', brightGreen: '#6ee7b7', brightYellow: '#fde68a', brightBlue: '#93c5fd', brightMagenta: '#d8b4fe', brightCyan: '#67e8f9', brightWhite: '#fafafa',
};

/** @typedef {{ id: number, term: Terminal, fit: FitAddon, pane: HTMLElement, tab: HTMLElement, exited: boolean, powershell: boolean }} Session */

export class TerminalPanel {
  /** @param {{ host: HTMLElement, tabs: HTMLElement, api: any, openLink: (url: string) => void }} opts */
  constructor({ host, tabs, api, openLink }) {
    this.host = host;
    this.openLink = openLink;
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

  /** @param {string} [cwd] @param {string} [shell] profile id from app:info's shells; the default when left out */
  async open(cwd, shell) {
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
    term.registerLinkProvider({ provideLinks: (y, done) => done(lineLinks(term, y, this.openLink)) });

    const pane = document.createElement('div');
    pane.className = 'term-pane';
    this.host.append(pane);
    term.open(pane);
    fit.fit();

    const info = await this.api.term.create({ cwd, shell, cols: term.cols, rows: term.rows });
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
    const paste = (/** @type {string} */ text) => this.api.term.write(id, text);
    term.attachCustomKeyEventHandler((e) => clipboardKeys(e, term, paste));
    // Right-click works like Windows Terminal: copy the selection if there is one, else paste.
    pane.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection()).catch(() => {});
        term.clearSelection();
      } else {
        navigator.clipboard.readText().then(paste).catch(() => {});
      }
      term.focus();
    });

    this.sessions.set(id, { id, term, fit, pane, tab, exited: false, powershell: Boolean(info.powershell) });
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
    this.api.term.setActive(id);
    this.fitActive();
    this.sessions.get(id)?.term.focus();
  }

  /** @param {number} id */
  close(id) {
    const s = this.sessions.get(id);
    if (!s) return;
    // Always, so main drops the session's output buffer even when the shell has exited.
    this.api.term.kill(id);
    s.term.dispose();
    s.pane.remove();
    s.tab.remove();
    this.sessions.delete(id);
    if (this.activeId === id) {
      const next = [...this.sessions.keys()].pop();
      this.activeId = null;
      if (next !== undefined) this.activate(next);
      else this.api.term.setActive(null);
    }
  }

  fitActive() {
    const s = this.activeId !== null ? this.sessions.get(this.activeId) : null;
    if (!s || !s.pane.offsetWidth) return;
    try { s.fit.fit(); } catch { /* hidden panel */ }
  }

  /** The terminal a confirmed command goes to: the active one, if it's PowerShell and still running. */
  runTarget() {
    const s = this.activeId !== null ? this.sessions.get(this.activeId) : null;
    if (!s || s.exited || !s.powershell) return null;
    return { id: s.id, label: /** @type {HTMLElement} */ (s.tab.querySelector('.title')).textContent || `terminal ${s.id}` };
  }

  focus() {
    const s = this.activeId !== null ? this.sessions.get(this.activeId) : null;
    s?.term.focus();
  }

  get size() { return this.sessions.size; }
}

/**
 * The web addresses on buffer line y (1-based) as xterm links that open a tab on click.
 * Reads the line cell by cell so a wide character before a link doesn't shift its columns.
 * ponytail: one row only, so a URL wrapped onto the next row links its first part.
 * @param {Terminal} term
 * @param {number} y
 * @param {(url: string) => void} open
 */
function lineLinks(term, y, open) {
  const line = term.buffer.active.getLine(y - 1);
  if (!line) return undefined;
  let text = '';
  /** @type {number[]} */
  const col = [];
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x);
    if (!cell || !cell.getWidth()) continue;
    const chars = cell.getChars() || ' ';
    text += chars;
    for (let i = 0; i < chars.length; i++) col.push(x + 1);
  }
  const links = findLinks(text).map((l) => ({
    range: { start: { x: col[l.start], y }, end: { x: col[l.start + l.text.length - 1], y } },
    text: l.text,
    activate: () => open(l.url),
  }));
  return links.length ? links : undefined;
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
