import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_MAX, cleanRecent, pushRecent } from '../src/shared/recent.js';

test('pushRecent puts the newest first and de-duplicates by type and target', () => {
  let list = pushRecent([], { type: 'url', target: 'https://a.com', label: 'A' }, 1);
  list = pushRecent(list, { type: 'file', target: 'x.md', label: 'x' }, 2);
  list = pushRecent(list, { type: 'url', target: 'https://a.com', label: 'A again' }, 3);
  assert.deepEqual(list.map((r) => [r.target, r.label, r.at]), [['https://a.com', 'A again', 3], ['x.md', 'x', 2]]);
});

test('same target with a different type is a different entry', () => {
  let list = pushRecent([], { type: 'folder', target: 'D:/x', label: 'x' }, 1);
  list = pushRecent(list, { type: 'terminal', target: 'D:/x', label: 'x' }, 2);
  assert.equal(list.length, 2);
});

test('pushRecent caps the list', () => {
  let list = [];
  for (let i = 0; i < RECENT_MAX + 10; i++) list = pushRecent(list, { type: 'url', target: `u${i}`, label: '' }, i);
  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0].target, `u${RECENT_MAX + 9}`);
});

test('cleanRecent drops malformed entries from a hand-edited file', () => {
  const cleaned = cleanRecent([
    { type: 'url', target: 'https://a.com', label: 'A', at: 1 },
    { type: 'nope', target: 'x', label: 'x', at: 1 },
    { type: 'file', target: 5, label: 'x', at: 1 },
    { type: 'file', target: 'x', label: 'x', at: 'yesterday' },
    null,
  ]);
  assert.equal(cleaned.length, 1);
  assert.deepEqual(cleanRecent({ not: 'a list' }), []);
});
