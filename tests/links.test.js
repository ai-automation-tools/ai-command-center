import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLinks } from '../src/shared/links.js';

test('findLinks finds the address a dev server prints, with its position', () => {
  assert.deepEqual(findLinks('  ➜  Local:   http://localhost:5173/'), [{ text: 'http://localhost:5173/', url: 'http://localhost:5173/', start: 14 }]);
  assert.deepEqual(findLinks('Listening on https://example.com:8443/app?x=1#top'), [{ text: 'https://example.com:8443/app?x=1#top', url: 'https://example.com:8443/app?x=1#top', start: 13 }]);
});

test('findLinks turns bare loopback hosts with a port into http links', () => {
  assert.deepEqual(findLinks('ready on localhost:3000').map((l) => l.url), ['http://localhost:3000']);
  assert.deepEqual(findLinks('127.0.0.1:8080/api and [::1]:9000').map((l) => [l.text, l.url]), [
    ['127.0.0.1:8080/api', 'http://127.0.0.1:8080/api'],
    ['[::1]:9000', 'http://[::1]:9000'],
  ]);
});

test('findLinks finds several links on a line without counting one twice', () => {
  const links = findLinks('http://localhost:3000 or https://example.com');
  assert.deepEqual(links.map((l) => [l.text, l.start]), [['http://localhost:3000', 0], ['https://example.com', 25]]);
});

test('findLinks drops trailing punctuation but keeps brackets the link opened', () => {
  assert.equal(findLinks('see https://example.com.')[0].text, 'https://example.com');
  assert.equal(findLinks('(at https://example.com/a)')[0].text, 'https://example.com/a');
  assert.equal(findLinks('"https://example.com/x",')[0].text, 'https://example.com/x');
  assert.equal(findLinks('https://example.com/wiki/Foo_(bar)')[0].text, 'https://example.com/wiki/Foo_(bar)');
  assert.equal(findLinks('[https://example.com/a[1]]')[0].text, 'https://example.com/a[1]');
});

test('findLinks ignores other schemes, hosts without a port, and lookalikes', () => {
  assert.deepEqual(findLinks('file:///C:/x ftp://example.com javascript:alert(1)'), []);
  assert.deepEqual(findLinks('localhost and 127.0.0.1 with no port'), []);
  assert.deepEqual(findLinks('foo.localhost:3000 user@localhost:22 xhttp://example.com'), []);
  assert.deepEqual(findLinks('http:// alone'), []);
  assert.deepEqual(findLinks('localhost:99999'), []);
});

test('findLinks answers empty and non-string input with no links', () => {
  assert.deepEqual(findLinks(''), []);
  assert.deepEqual(findLinks(/** @type {any} */ (undefined)), []);
  assert.deepEqual(findLinks(/** @type {any} */ (42)), []);
});
