// Turning the active page into (or out of) a Project Hub favorite. Hub's favorites
// are the `{ roots: [{ name, children }…] }` tree its /api/favorites endpoint reads
// and writes (PUT replaces the whole list); a link is `{ name, url }`, url http(s)
// only. Pure; src/main/hub.js does the GET and PUT around these helpers.

const isWeb = (url) => /^https?:\/\//i.test(url || '');

/** The two roots Hub returns when nothing has been starred yet. */
const EMPTY = () => [{ name: 'Favorites bar', children: [] }, { name: 'Other favorites', children: [] }];

/** A deep copy of the roots, or the empty default when they aren't a list. */
function normalize(roots) {
  return Array.isArray(roots) ? JSON.parse(JSON.stringify(roots)) : EMPTY();
}

/** Does any link anywhere in the tree carry this URL? */
export function isFavorite(roots, url) {
  if (!isWeb(url)) return false;
  const walk = (nodes) => nodes.some((n) => (n && Array.isArray(n.children) ? walk(n.children) : n && n.url === url));
  return walk(Array.isArray(roots) ? roots : []);
}

/** Remove links at `url` from anywhere; returns the rebuilt tree and whether any went. */
function drop(tree, url) {
  let removed = false;
  const next = [];
  for (const n of tree) {
    if (n && Array.isArray(n.children)) {
      const kids = drop(n.children, url);
      removed = removed || kids.removed;
      next.push({ name: n.name, children: kids.tree });
    } else if (n && n.url === url) {
      removed = true;
    } else {
      next.push(n);
    }
  }
  return { tree: next, removed };
}

/**
 * Add the page to the front of the Favorites bar, or remove it from wherever it is,
 * returning the new tree and whether the page is now starred. Non-web URLs are a no-op.
 * @param {unknown} roots
 * @param {{ url: string, name?: string }} page
 */
export function toggleFavorite(roots, page) {
  const { url } = page;
  const tree = normalize(roots);
  if (!isWeb(url)) return { roots: tree, starred: false };
  const after = drop(tree, url);
  if (after.removed) return { roots: after.tree, starred: false };
  const label = String(page.name || '').trim().slice(0, 500) || url;
  const bar = after.tree[0];
  if (bar && Array.isArray(bar.children)) bar.children.unshift({ name: label, url });
  else after.tree.unshift({ name: 'Favorites bar', children: [{ name: label, url }] });
  return { roots: after.tree, starred: true };
}
