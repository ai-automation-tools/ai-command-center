import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devIdFromUrl, devScripts, devStateText, devUrl, isScriptName, packageManager, readyAddress } from '../src/shared/devservers.js';
import { devLogPage } from '../src/shared/docs.js';
import { isAllowedNavigation, toUrl } from '../src/shared/url.js';

test('devScripts keeps the scripts that start a server, in file order', () => {
  const pkg = JSON.stringify({ scripts: { build: 'vite build', dev: 'vite', 'dev:api': 'node api.js', test: 'node --test', preview: 'vite preview', starter: 'x', 'start&calc': 'x', serve: 1 } });
  assert.deepEqual(devScripts(pkg), ['dev', 'dev:api', 'preview']);
  assert.deepEqual(devScripts('{not json'), []);
  assert.deepEqual(devScripts('{"name":"x"}'), []);
  assert.deepEqual(devScripts('null'), []);
});

test('isScriptName refuses anything a command line could misread', () => {
  assert.ok(isScriptName('dev:web'));
  for (const bad of ['', 'dev & calc', 'dev"', '-dev', 'a'.repeat(65), 'dev\n', 7]) assert.equal(isScriptName(bad), false, String(bad));
});

test('packageManager follows the lockfile', () => {
  assert.equal(packageManager((f) => f === 'pnpm-lock.yaml'), 'pnpm');
  assert.equal(packageManager((f) => f === 'yarn.lock'), 'yarn');
  assert.equal(packageManager(() => false), 'npm');
});

test('readyAddress finds the loopback address a server prints', () => {
  const vite = '  VITE v6.0.0  ready in 300 ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  Network: http://192.168.1.5:5173/';
  assert.deepEqual(readyAddress(vite), { url: 'http://localhost:5173/', port: 5173 });
  assert.deepEqual(readyAddress('Network: http://192.168.1.5:3000\nLocal: http://127.0.0.1:3000'), { url: 'http://127.0.0.1:3000/', port: 3000 });
  assert.deepEqual(readyAddress('listening on http://0.0.0.0:8080'), { url: 'http://127.0.0.1:8080/', port: 8080 });
  assert.deepEqual(readyAddress('Serving at localhost:4000'), { url: 'http://localhost:4000/', port: 4000 });
  assert.equal(readyAddress('see https://example.com/docs and http://localhost/'), null);
  assert.equal(readyAddress(''), null);
});

test('devUrl and devIdFromUrl round-trip, and nothing else parses', () => {
  assert.equal(devIdFromUrl(devUrl(12)), 12);
  for (const bad of ['acc://dev/', 'acc://dev/x', 'acc://dev/1/../2', 'acc://git/1', 'https://example.com/']) assert.equal(devIdFromUrl(bad), null, bad);
});

test('devStateText says where a server is, or how it ended', () => {
  assert.equal(devStateText({ state: 'ready', url: 'http://localhost:5173/', code: null }), 'http://localhost:5173/');
  assert.equal(devStateText({ state: 'starting', url: '', code: null }), 'starting…');
  assert.equal(devStateText({ state: 'exited', url: '', code: 1 }), 'exited (code 1)');
  assert.equal(devStateText({ state: 'exited', url: '', code: null }), 'failed to start');
  assert.equal(devStateText({ state: 'stopped', url: '', code: 1 }), 'stopped');
});

test('a dev server log opens from the app only, and its output is escaped', () => {
  assert.equal(isAllowedNavigation('acc://dev/3'), true);
  assert.equal(isAllowedNavigation('acc://dev/3', 'https://evil.example/'), false);
  assert.equal(isAllowedNavigation('acc://dev/3', 'acc://dev/2'), false);
  assert.equal(toUrl('acc://dev/3'), 'acc://dev/3');
  const html = devLogPage({ script: 'dev', folder: 'D:\\work\\acme', command: 'npm run dev', state: 'starting…', url: '', output: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<pre>&lt;script&gt;/);
  assert.match(html, /Dev servers › acme › dev/);
  assert.match(devLogPage({ script: 'dev', folder: 'D:\\a', command: '', state: 'stopped', url: '', output: '' }), /No output yet/);
});
