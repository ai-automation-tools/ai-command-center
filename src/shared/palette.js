// The command palette's (Ctrl+K) matching and order. Pure; the box itself is in
// src/renderer/palette.js.

/**
 * @typedef {'action' | 'workspace' | 'tab' | 'terminal' | 'file'} PaletteKind
 * @typedef {{ kind: PaletteKind, label: string, detail?: string }} PaletteItem
 */

/** Kinds in the order they list on an empty query, and break ties after that. */
export const KIND_ORDER = /** @type {PaletteKind[]} */ (['action', 'workspace', 'tab', 'terminal', 'file']);

/**
 * Every word of the query must appear in the label or the detail. Items whose label
 * holds every word come first, a label that starts with the first word before that,
 * then by kind, then shorter labels. An empty query keeps the given order.
 * @template {PaletteItem} T
 * @param {T[]} items
 * @param {string} query
 * @param {number} [limit]
 * @returns {T[]}
 */
export function rankPalette(items, query, limit = 50) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items.slice(0, limit);
  /** @type {{ item: T, score: number }[]} */
  const hits = [];
  for (const item of items) {
    const label = item.label.toLowerCase();
    const hay = `${label} ${(item.detail || '').toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const score = (words.every((w) => label.includes(w)) ? 0 : 10_000)
      + (label.startsWith(words[0]) ? 0 : 1000)
      + KIND_ORDER.indexOf(item.kind) * 100
      + Math.min(label.length, 99);
    hits.push({ item, score });
  }
  hits.sort((a, b) => a.score - b.score);
  return hits.slice(0, limit).map((h) => h.item);
}
