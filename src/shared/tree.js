// Pure helpers over Project Hub's /api/scan tree. No Electron, no DOM, so they run
// under `node --test` as-is.

/** Kinds Project Hub uses for nodes that hold other nodes. */
const CONTAINER_KINDS = new Set([
  'projects', 'root', 'section', 'cli', 'folder', 'repo', 'group', 'draft', 'docroot', 'userroot',
]);

/**
 * @typedef {{ id: string, name: string, kind: string, children?: HubNode[], desc?: string, size?: number }} HubNode
 */

/** @param {HubNode} node */
export function isContainer(node) {
  return Array.isArray(node.children) || CONTAINER_KINDS.has(node.kind);
}

/**
 * Turn a Hub node id into an absolute Windows-style path with forward slashes.
 * Ids are relative to the scan's `base`, except `~/...`, which is the home folder,
 * and `@...`, which is a virtual grouping with no path at all.
 * @param {string} id
 * @param {{ base: string, home: string }} scan
 * @returns {string | null}
 */
export function absPath(id, scan) {
  if (!id || id.startsWith('@')) return null;
  if (id === '~') return scan.home;
  if (id.startsWith('~/')) return `${scan.home}/${id.slice(2)}`;
  return `${scan.base}/${id}`;
}

/**
 * What a click on a node should do. Folders expand; HTML opens in a browser tab;
 * everything else opens in VS Code through Hub's /api/open.
 * @param {HubNode} node
 * @returns {'expand' | 'browse' | 'code'}
 */
export function defaultAction(node) {
  if (isContainer(node)) return 'expand';
  if (node.kind === 'html' || /\.html?$/i.test(node.name)) return 'browse';
  return 'code';
}

/**
 * The folder a terminal should start in for this node: the node itself when it's a
 * container, otherwise its parent.
 * @param {HubNode} node
 * @param {{ base: string, home: string }} scan
 */
export function terminalDir(node, scan) {
  const p = absPath(node.id, scan);
  if (!p) return null;
  return isContainer(node) ? p : p.slice(0, p.lastIndexOf('/'));
}

/**
 * Flatten a tree into search entries. Iterative, so a 35k-node scan can't blow the stack.
 * @param {HubNode[]} roots
 * @returns {{ node: HubNode, path: string }[]}
 */
export function flatten(roots) {
  /** @type {{ node: HubNode, path: string }[]} */
  const out = [];
  /** @type {{ node: HubNode, trail: string }[]} */
  const stack = roots.map((node) => ({ node, trail: '' })).reverse();
  while (stack.length) {
    const { node, trail } = /** @type {{ node: HubNode, trail: string }} */ (stack.pop());
    const path = trail ? `${trail} / ${node.name}` : node.name;
    out.push({ node, path });
    const kids = node.children || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push({ node: kids[i], trail: path });
  }
  return out;
}

/**
 * Case-insensitive search over flattened entries. Every word in the query has to
 * appear in the name or the trail. Name matches rank ahead of trail-only matches,
 * then shorter names first.
 * @param {{ node: HubNode, path: string }[]} entries
 * @param {string} query
 * @param {number} [limit]
 */
export function search(entries, query, limit = 50) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const e of entries) {
    const name = e.node.name.toLowerCase();
    const hay = e.path.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    const score = (words.every((w) => name.includes(w)) ? 0 : 1000) + name.length;
    hits.push({ ...e, score });
  }
  hits.sort((a, b) => a.score - b.score);
  return hits.slice(0, limit);
}

/**
 * Flatten a browser bookmark tree (Hub's /api/webmarks or /api/favorites shape:
 * folders are `{ name, children }`, links are `{ name, url }`) into search entries.
 * @param {{ name: string, url?: string, children?: any[] }[]} roots
 */
export function flattenBookmarks(roots) {
  /** @type {{ name: string, url: string, path: string }[]} */
  const out = [];
  const stack = roots.map((n) => ({ n, trail: '' }));
  while (stack.length) {
    const { n, trail } = /** @type {{ n: any, trail: string }} */ (stack.pop());
    const path = trail ? `${trail} / ${n.name}` : n.name;
    if (n.url) out.push({ name: n.name || n.url, url: n.url, path });
    for (const c of n.children || []) stack.push({ n: c, trail: path });
  }
  return out;
}
