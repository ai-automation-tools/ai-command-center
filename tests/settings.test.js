import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_HUB_URL, settingsFrom } from '../src/shared/settings.js';

test('settingsFrom gives neutral defaults for no file, junk, or an empty object', () => {
  for (const raw of [undefined, null, 'x', [], {}]) {
    const s = settingsFrom(raw);
    assert.equal(s.hubUrl, DEFAULT_HUB_URL);
    assert.deepEqual(s.quickLinks.map((l) => l.label), ['Project Hub', 'Chrome Web Store']);
    assert.equal(s.quickLinks[0].url, DEFAULT_HUB_URL);
  }
});

test('settingsFrom takes the file hub URL, trimmed, http(s) only, and the environment wins', () => {
  assert.equal(settingsFrom({ hubUrl: ' http://localhost:5000/ ' }).hubUrl, 'http://localhost:5000');
  assert.equal(settingsFrom({ hubUrl: 'file:///C:/hub' }).hubUrl, DEFAULT_HUB_URL);
  assert.equal(settingsFrom({ hubUrl: 'not a url' }).hubUrl, DEFAULT_HUB_URL);
  assert.equal(settingsFrom({ hubUrl: 'http://localhost:5000' }, { ACC_HUB_URL: 'https://hub.example:9/' }).hubUrl, 'https://hub.example:9');
  assert.equal(settingsFrom({ hubUrl: 'http://localhost:5000' }, { ACC_HUB_URL: 'javascript:1' }).hubUrl, 'http://localhost:5000');
});

test('settingsFrom keeps only well-formed quick links, capped, and the default link follows the hub URL', () => {
  const s = settingsFrom({
    hubUrl: 'http://localhost:5000',
    quickLinks: [
      { label: ' Docs ', url: 'https://docs.example/' },
      { label: '', url: 'https://nolabel.example' },
      { label: 'No url' },
      { label: 'Bad scheme', url: 'javascript:alert(1)' },
      'junk',
      { label: 'x'.repeat(100), url: 'http://long.example' },
    ],
  });
  assert.deepEqual(s.quickLinks, [
    { label: 'Docs', url: 'https://docs.example' },
    { label: 'x'.repeat(40), url: 'http://long.example' },
  ]);
  assert.equal(settingsFrom({ hubUrl: 'http://localhost:5000', quickLinks: 'nope' }).quickLinks[0].url, 'http://localhost:5000');
  const many = settingsFrom({ quickLinks: Array.from({ length: 20 }, (_, i) => ({ label: `l${i}`, url: `https://l${i}.example` })) });
  assert.equal(many.quickLinks.length, 12);
});
