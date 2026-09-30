import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVED_TABS_MAX, cleanSavedTabs, savedActiveIndex } from '../src/shared/session.js';

test('cleanSavedTabs keeps allowed URLs in order and drops the rest', () => {
  assert.deepEqual(
    cleanSavedTabs(['https://a.com', 'about:blank', '', 'javascript:alert(1)', 5, null, 'file:///D:/x.html', 'data:text/html,x']),
    ['https://a.com', 'file:///D:/x.html'],
  );
});

test('cleanSavedTabs returns [] for anything that is not an array', () => {
  assert.deepEqual(cleanSavedTabs(undefined), []);
  assert.deepEqual(cleanSavedTabs('https://a.com'), []);
});

test('cleanSavedTabs caps the list', () => {
  const many = Array.from({ length: SAVED_TABS_MAX + 5 }, (_, i) => `https://x.com/${i}`);
  assert.equal(cleanSavedTabs(many).length, SAVED_TABS_MAX);
});

test('savedActiveIndex falls back to the last tab when the index is bad', () => {
  assert.equal(savedActiveIndex(1, 3), 1);
  assert.equal(savedActiveIndex(3, 3), 2);
  assert.equal(savedActiveIndex(-1, 3), 2);
  assert.equal(savedActiveIndex('1', 3), 2);
  assert.equal(savedActiveIndex(undefined, 0), -1);
});
