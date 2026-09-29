// The left sidebar: Files (Project Hub's tree), Bookmarks (browser profiles Hub reads,
// plus Hub's own favorites), Recent, and one search box across all three.

import { absPath, defaultAction, flatten, flattenBookmarks, isContainer, search, terminalDir } from '/shared/tree.js';

const ICONS = {
  projects: '🗂️', root: '📦', section: '📁', cli: '🤖', folder: '📁', repo: '📘', group: '🗃️', draft: '🧪',
  docroot: '📚', userroot: '👤', md: '📝', html: '🌐', file: '📄', image: '🖼️', pdf: '📕', config: '⚙️',
  skill: '🧩', agent: '🧠', command: '⌘', hook: '🪝', routine: '⏱️', style: '🎨',
};
const RECENT_ICONS = { url: '🌐', file: '📄', folder: '📁', terminal: '💻' };
const HUB_FAVORITES = '@hub-favorites';

/** @typedef {import('/shared/tree.js').HubNode} HubNode */

export class Sidebar {
  /**
   * @param {{
   *   api: any,
   *   layout: { bookmarkSource: string },
   *   openUrl: (url: string, opts?: { background?: boolean }) => void,
   *   openTerminal: (cwd: string) => void,
   * }} opts
   */
  constructor({ api, layout, openUrl, openTerminal }) {
    this.api = api;
    this.openUrl = openUrl;
    this.openTerminal = openTerminal;
    /** @type {{ base: string, home: string, tree: HubNode[] } | null} */
    this.scan = null;
    /** @type {ReturnType<typeof flatten>} */
    this.fileIndex = [];
    /** @type {ReturnType<typeof flattenBookmarks>} */
    this.bookmarkIndex = [];
    /** @type {any[]} */
    this.recent = [];
    this.bookmarkSource = layout.bookmarkSource;

    this.el = {
      files: /** @type {HTMLElement} */ (document.getElementById('panel-files')),
      bookmarks: /** @type {HTMLElement} */ (document.getElementById('panel-bookmarks')),
      bookmarkTree: /** @type {HTMLElement} */ (document.getElementById('bookmark-tree')),
      source: /** @type {HTMLSelectElement} */ (document.getElementById('bookmark-source')),
      recent: /** @type {HTMLElement} */ (document.getElementById('panel-recent')),
      results: /** @type {HTMLElement} */ (document.getElementById('panel-search')),
      search: /** @type {HTMLInputElement} */ (document.getElementById('search')),
      status: /** @type {HTMLElement} */ (document.getElementById('hub-status')),
    };
    this.current = 'files';

    for (const btn of document.querySelectorAll('.side-tabs button')) {
      btn.addEventListener('click', () => this.show(/** @type {HTMLElement} */ (btn).dataset.panel || 'files'));
    }
    let timer = 0;
    this.el.search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => this.runSearch(), 120);
    });
    this.el.search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.el.search.value = ''; this.runSearch(); }
      if (e.key === 'Enter') /** @type {HTMLElement | null} */ (this.el.results.querySelector('.row'))?.click();
    });
    this.el.source.addEventListener('change', () => {
      this.bookmarkSource = this.el.source.value;
      this.api.saveLayout({ bookmarkSource: this.bookmarkSource });
      this.loadBookmarks();
    });
    api.recent.onChanged((/** @type {any[]} */ list) => { this.recent = list; this.renderRecent(); });
  }

  async load() {
    this.checkHub();
    window.setInterval(() => this.checkHub(), 60_000);
    this.recent = await this.api.recent.list();
    this.renderRecent();
    await Promise.all([this.loadFiles(), this.loadBookmarks()]);
  }

  async checkHub() {
    const h = await this.api.hub.health();
    this.el.status.className = `dot ${h.ok ? 'ok' : 'bad'}`;
    this.el.status.title = `Project Hub: ${h.ok ? 'ready' : h.state}`;
  }

  /** @param {boolean} [fresh] */
  async loadFiles(fresh = false) {
    this.el.files.innerHTML = '<div class="panel-note">Loading the Project Hub tree… a cold scan takes about 12 seconds.</div>';
    try {
      this.scan = await this.api.hub.scan(fresh);
      this.fileIndex = flatten(this.scan.tree);
      this.el.files.innerHTML = '';
      const list = document.createElement('div');
      for (const node of this.scan.tree) list.append(this.fileRow(node, 0));
      this.el.files.append(list);
    } catch (err) {
      this.el.files.innerHTML = '';
      this.el.files.append(note(`${errText(err)}\n\nStart it with Repos/AI-Automation-Tools/Tools/HTML-Project-Design/Hub/Start-Hub.ps1, then press Retry.`, true));
      const retry = document.createElement('button');
      retry.textContent = 'Retry';
      retry.className = 'panel-note';
      retry.addEventListener('click', () => this.loadFiles(true));
      this.el.files.append(retry);
    }
  }

  /**
   * One tree row, lazily expanding its children on first open.
   * @param {HubNode} node
   * @param {number} depth
   */
  fileRow(node, depth) {
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'row';
    row.tabIndex = 0;
    row.style.paddingLeft = `${8 + depth * 14}px`;
    row.title = node.desc ? `${node.name}\n${node.desc}` : node.name;
    const container = isContainer(node) && (node.children?.length ?? 0) > 0;
    row.innerHTML = `<span class="caret">${container ? '▸' : ''}</span><span class="icon"></span><span class="name"></span><span class="acts"></span>`;
    q(row, '.icon').textContent = ICONS[/** @type {keyof typeof ICONS} */ (node.kind)] || (isContainer(node) ? '📁' : '📄');
    q(row, '.name').textContent = node.name;
    this.addFileActions(q(row, '.acts'), node);
    wrap.append(row);

    /** @type {HTMLElement | null} */
    let kids = null;
    const toggle = () => {
      if (!container) return;
      if (!kids) {
        kids = document.createElement('div');
        for (const c of node.children || []) kids.append(this.fileRow(c, depth + 1));
        wrap.append(kids);
      } else {
        kids.hidden = !kids.hidden;
      }
      q(row, '.caret').textContent = kids.hidden ? '▸' : '▾';
    };
    row.addEventListener('click', (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest('.acts')) return;
      if (defaultAction(node) === 'expand') toggle();
      else this.activateFile(node);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') row.click();
      if (e.key === 'ArrowRight' && container && (!kids || kids.hidden)) toggle();
      if (e.key === 'ArrowLeft' && kids && !kids.hidden) toggle();
      if (e.key === 'ArrowDown') /** @type {HTMLElement | null} */ (nextRow(row, 1))?.focus();
      if (e.key === 'ArrowUp') /** @type {HTMLElement | null} */ (nextRow(row, -1))?.focus();
    });
    return wrap;
  }

  /** @param {HTMLElement} host @param {HubNode} node */
  addFileActions(host, node) {
    if (!this.scan || node.id.startsWith('@')) return;
    const scan = this.scan;
    host.append(
      button('>_', 'Terminal here', () => {
        const dir = terminalDir(node, scan);
        if (dir) this.openTerminal(dir);
      }),
      button('code', 'Open in VS Code', () => this.openInHub(node, 'code')),
      button('📂', 'Reveal in Explorer', () => this.openInHub(node, 'reveal')),
    );
    if (!isContainer(node)) {
      host.append(button('🌐', 'Open in a browser tab', () => {
        const p = absPath(node.id, scan);
        if (p) this.openUrl(`file:///${p}`);
      }));
    }
  }

  /** @param {HubNode} node */
  activateFile(node) {
    if (!this.scan) return;
    if (defaultAction(node) === 'browse') {
      const p = absPath(node.id, this.scan);
      if (p) this.openUrl(`file:///${p}`);
    } else {
      this.openInHub(node, 'code');
    }
  }

  /** @param {HubNode} node @param {'code' | 'reveal'} how */
  async openInHub(node, how) {
    try {
      await this.api.hub.open(node.id, how, node.name);
    } catch (err) {
      toast(errText(err));
    }
  }

  async loadBookmarks() {
    const tree = this.el.bookmarkTree;
    tree.innerHTML = '<div class="panel-note">Loading bookmarks…</div>';
    try {
      const wantHub = this.bookmarkSource === HUB_FAVORITES;
      const data = wantHub ? await this.api.hub.favorites() : await this.api.hub.webmarks(this.bookmarkSource || undefined);
      if (!wantHub || !this.el.source.options.length) {
        const sources = wantHub ? (await this.api.hub.webmarks()).sources : data.sources;
        this.fillSources(sources, wantHub ? HUB_FAVORITES : data.source);
      }
      const roots = data.roots || [];
      this.bookmarkIndex = flattenBookmarks(roots);
      tree.innerHTML = '';
      for (const r of roots) tree.append(this.bookmarkRow(r, 0, true));
      if (!this.bookmarkIndex.length) tree.append(note('No bookmarks in this source.'));
    } catch (err) {
      tree.innerHTML = '';
      tree.append(note(errText(err), true));
    }
  }

  /** @param {{ id: string, label: string }[]} sources @param {string} selected */
  fillSources(sources, selected) {
    const sel = this.el.source;
    sel.innerHTML = '';
    for (const s of sources) sel.append(new Option(s.label, s.id, false, s.id === selected));
    sel.append(new Option('Project Hub favorites', HUB_FAVORITES, false, selected === HUB_FAVORITES));
  }

  /**
   * @param {{ name: string, url?: string, children?: any[] }} n
   * @param {number} depth
   * @param {boolean} open
   */
  bookmarkRow(n, depth, open) {
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'row';
    row.tabIndex = 0;
    row.style.paddingLeft = `${8 + depth * 14}px`;
    const folder = !n.url;
    row.innerHTML = `<span class="caret">${folder ? (open ? '▾' : '▸') : ''}</span><span class="icon">${folder ? '📁' : '🔖'}</span><span class="name"></span>`;
    q(row, '.name').textContent = n.name || n.url || '';
    row.title = n.url || n.name;
    wrap.append(row);
    if (folder) {
      const kids = document.createElement('div');
      kids.hidden = !open;
      let built = false;
      const build = () => {
        if (built) return;
        built = true;
        for (const c of n.children || []) kids.append(this.bookmarkRow(c, depth + 1, false));
      };
      if (open) build();
      wrap.append(kids);
      row.addEventListener('click', () => {
        build();
        kids.hidden = !kids.hidden;
        q(row, '.caret').textContent = kids.hidden ? '▸' : '▾';
      });
    } else {
      row.addEventListener('click', (e) => this.openUrl(/** @type {string} */ (n.url), { background: e.ctrlKey }));
      row.addEventListener('auxclick', (e) => { if (e.button === 1) this.openUrl(/** @type {string} */ (n.url), { background: true }); });
    }
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') row.click(); });
    return wrap;
  }

  renderRecent() {
    const host = this.el.recent;
    host.innerHTML = '';
    if (!this.recent.length) { host.append(note('Files, pages and terminals you open show up here.')); return; }
    for (const r of this.recent) host.append(this.recentRow(r));
  }

  /** @param {{ type: 'url' | 'file' | 'folder' | 'terminal', target: string, label: string, at: number }} r */
  recentRow(r) {
    const row = document.createElement('div');
    row.className = 'row';
    row.tabIndex = 0;
    row.style.paddingLeft = '10px';
    row.innerHTML = '<span class="icon"></span><span class="name"></span><span class="sub"></span>';
    q(row, '.icon').textContent = RECENT_ICONS[r.type] || '•';
    q(row, '.name').textContent = r.label;
    q(row, '.sub').textContent = ago(r.at);
    row.title = r.target;
    row.addEventListener('click', () => {
      if (r.type === 'url') this.openUrl(r.target);
      if (r.type === 'terminal' || r.type === 'folder') this.openTerminal(r.target);
      if (r.type === 'file') this.api.hub.open(r.target, 'code', r.label).catch((/** @type {unknown} */ err) => toast(errText(err)));
    });
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') row.click(); });
    return row;
  }

  /** @param {string} name */
  show(name) {
    this.current = name;
    for (const btn of document.querySelectorAll('.side-tabs button')) {
      btn.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (btn).dataset.panel === name));
    }
    if (this.el.search.value.trim()) return;
    this.el.files.hidden = name !== 'files';
    this.el.bookmarks.hidden = name !== 'bookmarks';
    this.el.recent.hidden = name !== 'recent';
  }

  focusSearch() {
    this.el.search.focus();
    this.el.search.select();
  }

  runSearch() {
    const query = this.el.search.value.trim();
    const res = this.el.results;
    if (!query) {
      res.hidden = true;
      this.show(this.current);
      return;
    }
    this.el.files.hidden = this.el.bookmarks.hidden = this.el.recent.hidden = true;
    res.hidden = false;
    res.innerHTML = '';

    const words = query.toLowerCase().split(/\s+/);
    const match = (/** @type {string} */ s) => words.every((w) => s.toLowerCase().includes(w));

    const files = search(this.fileIndex, query, 40);
    const marks = this.bookmarkIndex.filter((b) => match(`${b.name} ${b.url} ${b.path}`)).slice(0, 25);
    const recent = this.recent.filter((r) => match(`${r.label} ${r.target}`)).slice(0, 15);

    if (!files.length && !marks.length && !recent.length) { res.append(note(`Nothing matches "${query}".`)); return; }

    if (files.length) {
      res.append(groupTitle(`Files (${files.length}${files.length === 40 ? '+' : ''})`));
      for (const f of files) {
        const row = this.fileRow(f.node, 0);
        const first = /** @type {HTMLElement} */ (row.firstElementChild);
        const sub = document.createElement('span');
        sub.className = 'sub';
        sub.textContent = f.path.split(' / ').slice(-3, -1).join(' / ');
        first.insertBefore(sub, first.querySelector('.acts'));
        res.append(row);
      }
    }
    if (marks.length) {
      res.append(groupTitle(`Bookmarks (${marks.length})`));
      for (const b of marks) res.append(this.bookmarkRow({ name: b.name, url: b.url }, 0, false));
    }
    if (recent.length) {
      res.append(groupTitle(`Recent (${recent.length})`));
      for (const r of recent) res.append(this.recentRow(r));
    }
  }
}

/** @param {HTMLElement} el @param {string} sel */
function q(el, sel) { return /** @type {HTMLElement} */ (el.querySelector(sel)); }

/** @param {string} text @param {boolean} [bad] */
function note(text, bad = false) {
  const d = document.createElement('div');
  d.className = `panel-note${bad ? ' bad' : ''}`;
  d.style.whiteSpace = 'pre-line';
  d.textContent = text;
  return d;
}

/** @param {string} text */
function groupTitle(text) {
  const d = document.createElement('div');
  d.className = 'group-title';
  d.textContent = text;
  return d;
}

/** @param {string} label @param {string} title @param {() => void} fn */
function button(label, title, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
}

/** @param {HTMLElement} row @param {1 | -1} dir */
function nextRow(row, dir) {
  const rows = [...document.querySelectorAll('.panel:not([hidden]) .row')].filter((r) => /** @type {HTMLElement} */ (r).offsetParent);
  const i = rows.indexOf(row);
  return rows[i + dir];
}

/** @param {unknown} err */
function errText(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

/** @param {number} at */
function ago(at) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** @param {string} text */
export function toast(text) {
  const t = document.createElement('div');
  t.textContent = text;
  Object.assign(t.style, {
    position: 'fixed', left: '12px', bottom: '12px', maxWidth: '420px', padding: '10px 12px', zIndex: '10',
    background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f4f4f5', whiteSpace: 'pre-line',
  });
  document.body.append(t);
  setTimeout(() => t.remove(), 6000);
}
