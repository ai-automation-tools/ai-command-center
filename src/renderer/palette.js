// The command palette (Ctrl+K): one box over actions, workspaces, tabs, terminals and
// files. A native <dialog>, so focus stays in it and Escape closes it. Matching is in
// shared/palette.js; what each entry does is the caller's.

import { rankPalette } from './shared/palette.js';

const ICONS = { action: '⚡', workspace: '🧭', tab: '🌐', terminal: '>_', file: '📄' };

/** @typedef {import('./shared/palette.js').PaletteItem & { run: () => unknown }} Entry */

/**
 * @param {{
 *   items: () => Entry[],
 *   files: (query: string) => Entry[],
 *   onOpen: () => void,
 *   onClose: () => void,
 * }} opts items: listed every time it opens; files: searched only once something is typed
 */
export function createPalette({ items, files, onOpen, onClose }) {
  const dlg = /** @type {HTMLDialogElement} */ (document.getElementById('palette'));
  const input = /** @type {HTMLInputElement} */ (document.getElementById('palette-input'));
  const list = /** @type {HTMLElement} */ (document.getElementById('palette-list'));
  /** @type {Entry[]} */
  let base = [];
  /** @type {Entry[]} */
  let shown = [];
  let sel = 0;

  const mark = () => {
    list.querySelectorAll('.pal-row').forEach((row, i) => {
      row.classList.toggle('active', i === sel);
      row.setAttribute('aria-selected', String(i === sel));
      if (i === sel) row.scrollIntoView({ block: 'nearest' });
    });
    input.setAttribute('aria-activedescendant', shown.length ? `pal-${sel}` : '');
  };

  const render = () => {
    const q = input.value;
    shown = rankPalette([...base, ...(q.trim() ? files(q) : [])], q);
    sel = 0;
    list.innerHTML = '';
    shown.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'row pal-row';
      row.id = `pal-${i}`;
      row.setAttribute('role', 'option');
      row.innerHTML = '<span class="icon"></span><span class="name"></span><span class="sub"></span>';
      /** @type {HTMLElement} */ (row.querySelector('.icon')).textContent = ICONS[e.kind];
      /** @type {HTMLElement} */ (row.querySelector('.name')).textContent = e.label;
      /** @type {HTMLElement} */ (row.querySelector('.sub')).textContent = e.detail || '';
      row.addEventListener('mousemove', () => { if (sel !== i) { sel = i; mark(); } });
      row.addEventListener('click', () => pick(i));
      list.append(row);
    });
    if (!shown.length) list.innerHTML = '<div class="panel-note">Nothing matches.</div>';
    mark();
  };

  /** Close first, so whatever the entry does (focus, a hidden tab) isn't undone by the close. @param {number} i */
  const pick = (i) => {
    const e = shown[i];
    if (!e) return;
    dlg.close();
    e.run();
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (shown.length) sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
      mark();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      pick(sel);
    }
  });
  // A click on the backdrop lands on the dialog itself.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', onClose);

  return {
    open() {
      if (dlg.open) {
        input.select();
        return;
      }
      base = items();
      input.value = '';
      onOpen();
      dlg.showModal();
      render();
      input.focus();
    },
  };
}
