import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFavorite, toggleFavorite } from '../src/shared/favorites.js';

const EMPTY = () => [{ name: 'Favorites bar', children: [] }, { name: 'Other favorites', children: [] }];

test('toggleFavorite adds a page to the front of the Favorites bar', () => {
  const { roots, starred } = toggleFavorite(EMPTY(), { url: 'https://example.com', name: 'Example' });
  assert.equal(starred, true);
  assert.equal(roots[0].children.length, 1);
  assert.deepEqual(roots[0].children[0], { name: 'Example', url: 'https://example.com' });
});

test('toggleFavorite removes the page wherever it is, and toggles back off', () => {
  const start = [{ name: 'Favorites bar', children: [] }, { name: 'Other favorites', children: [{ name: 'Old', url: 'https://x.example/a' }, { name: 'Fold', children: [{ name: 'Deep', url: 'https://x.example/b' }] }] }];
  const off = toggleFavorite(start, { url: 'https://x.example/b' });
  assert.equal(off.starred, false);
  assert.equal(isFavorite(off.roots, 'https://x.example/b'), false);
  assert.equal(isFavorite(off.roots, 'https://x.example/a'), true);
});

test('toggleFavorite fills a blank name with the URL, and caps a long one', () => {
  const blank = toggleFavorite(EMPTY(), { url: 'https://example.com' });
  assert.equal(blank.roots[0].children[0].name, 'https://example.com');
  const long = toggleFavorite(EMPTY(), { url: 'https://example.com', name: 'x'.repeat(600) });
  assert.equal(long.roots[0].children[0].name.length, 500);
});

test('toggleFavorite ignores non-web URLs and missing or malformed roots', () => {
  const noop = toggleFavorite(EMPTY(), { url: 'file:///C:/x', name: 'x' });
  assert.equal(noop.starred, false);
  assert.equal(noop.roots[0].children.length, 0);
  const missing = toggleFavorite(null, { url: 'https://example.com' });
  assert.equal(missing.starred, true);
  assert.equal(missing.roots[0].name, 'Favorites bar');
  assert.deepEqual(missing.roots[0].children[0], { name: 'https://example.com', url: 'https://example.com' });
});

test('isFavorite matches only exact web URLs', () => {
  const roots = [{ name: 'Favorites bar', children: [{ name: 'A', url: 'https://a.example/' }] }];
  assert.equal(isFavorite(roots, 'https://a.example/'), true);
  assert.equal(isFavorite(roots, 'https://a.example'), false);
  assert.equal(isFavorite(roots, 'http://a.example/'), false);
  assert.equal(isFavorite(roots, 'file:///C:/x'), false);
});

test('toggleFavorite does not mutate the tree it is given', () => {
  const roots = [{ name: 'Favorites bar', children: [] }];
  toggleFavorite(roots, { url: 'https://example.com', name: 'E' });
  assert.deepEqual(roots, [{ name: 'Favorites bar', children: [] }]);
});
