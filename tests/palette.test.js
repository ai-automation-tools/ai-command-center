import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankPalette } from '../src/shared/palette.js';

/** @type {import('../src/shared/palette.js').PaletteItem[]} */
const items = [
  { kind: 'action', label: 'New terminal', detail: 'Ctrl+Shift+`' },
  { kind: 'action', label: 'Toggle terminal', detail: 'Ctrl+`' },
  { kind: 'workspace', label: 'acme-api', detail: 'D:\\work\\acme-api' },
  { kind: 'tab', label: 'Example Domain', detail: 'https://example.com/' },
  { kind: 'terminal', label: 'pwsh · work/acme-api', detail: 'D:\\work\\acme-api' },
  { kind: 'file', label: 'README.md', detail: 'acme-api / README.md' },
];

test('an empty query keeps the given order, capped', () => {
  assert.deepEqual(rankPalette(items, '  '), items);
  assert.equal(rankPalette(items, '', 2).length, 2);
});

test('every word has to match the label or the detail, any case', () => {
  assert.deepEqual(rankPalette(items, 'EXAMPLE com').map((i) => i.label), ['Example Domain']);
  assert.deepEqual(rankPalette(items, 'nothing here'), []);
});

test('label matches beat detail-only matches, then label prefix, then kind', () => {
  assert.deepEqual(rankPalette(items, 'acme').map((i) => i.kind), ['workspace', 'terminal', 'file']);
  assert.deepEqual(rankPalette(items, 'terminal').map((i) => i.label), ['New terminal', 'Toggle terminal'], 'same kind: shorter first');
});

test('a label that starts with the query comes first among label matches', () => {
  const ranked = rankPalette([
    { kind: 'action', label: 'Reopen closed tab' },
    { kind: 'action', label: 'New tab' },
    { kind: 'action', label: 'Tab 1' },
  ], 'tab');
  assert.equal(ranked[0].label, 'Tab 1');
});
