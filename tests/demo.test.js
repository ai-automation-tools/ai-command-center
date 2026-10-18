import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { demoApi, commandOutput, TREE } from '../src/demo/acc.js';
import { demoHtml, REPO_URL } from '../src/demo/page.js';
import { flatten } from '../src/shared/tree.js';
import { ABOUT_HTML, WELCOME_ID, WELCOME_URL } from '../src/demo/about.js';

const read = (/** @type {string} */ p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('demoHtml adds the source bar and loads the mock before app.js', () => {
  const html = demoHtml(read('../src/renderer/index.html'));
  assert.ok(html.indexOf('demo/install.js') < html.indexOf('src="app.js"'));
  assert.ok(html.indexOf('class="src-bar"') < html.indexOf('id="app"'));
  assert.ok(html.includes(`href="${REPO_URL}"`));
  // Every path relative, so the page serves under a Pages subpath.
  assert.doesNotMatch(html, /(src|href)="\/[^/]/);
  assert.throws(() => demoHtml('<html><body></body></html>'), /expected/);
});

test('renderer imports are relative', () => {
  for (const f of ['app.js', 'sidebar.js', 'terminal.js', 'chat.js']) {
    assert.doesNotMatch(read(`../src/renderer/${f}`), /from '\//, f);
  }
});

test('the mock answers every call the preload exposes', () => {
  const preload = read('../src/preload/shell.cjs');
  const block = preload.slice(preload.indexOf("exposeInMainWorld('acc'"));
  const names = [...block.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
  assert.ok(names.length > 40);
  /** @param {any} o @returns {string[]} */
  const keys = (o) => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? [k, ...keys(v)] : [k]));
  const have = new Set(keys(demoApi()));
  assert.deepEqual(names.filter((n) => !have.has(n)), []);
});

test('the demo makes no network calls', () => {
  for (const f of ['acc.js', 'install.js', 'page.js', 'about.js']) {
    assert.doesNotMatch(read(`../src/demo/${f}`), /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, f);
  }
});

test('fake terminal echoes, answers npm test and handles unknown commands', async () => {
  const api = demoApi();
  /** @type {string[]} */
  const got = [];
  api.term.onData((/** @type {number} */ _id, /** @type {string} */ d) => got.push(d));
  const t = await api.term.create({ cwd: 'D:/work/x', shell: 'cmd' });
  assert.equal(t.powershell, false);
  api.term.write(t.id, 'npm test\r');
  await new Promise((r) => setTimeout(r, 60));
  const text = got.join('');
  assert.match(text, /D:\\work\\x>/);
  assert.match(text, /pass 3/);
  assert.match(commandOutput('rm -rf /'), /didn't run/);
  assert.equal(commandOutput('   '), '');
});

test('tabs keep history and reopen the last closed one', async () => {
  /** @type {any[]} */
  const shown = [];
  const api = demoApi({ onTab: (t) => shown.push(t) });
  const id = await api.tabs.create('example.com');
  await api.tabs.navigate('https://example.com/b');
  await api.tabs.command('back');
  assert.equal(shown.at(-1).url, 'https://example.com');
  await api.tabs.close(id);
  assert.equal(shown.at(-1), null);
  await api.tabs.command('reopen');
  assert.equal(shown.at(-1).url, 'https://example.com');
});

test('the confirm bar ask runs only after Run', async () => {
  const api = demoApi({ askAfterMs: 0 });
  /** @type {any[]} */
  const asks = [];
  /** @type {any[]} */
  const logged = [];
  api.mcp.onConfirm((/** @type {any} */ a) => asks.push(a));
  api.mcp.onLogged((/** @type {any} */ e) => logged.push(e));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(asks[0].command, 'npm test');
  await api.mcp.answer(asks[0].id, null);
  assert.equal(logged[0].ok, false);
});

test('fabricated tree has no virtual node with a path and flattens', () => {
  const flat = flatten(TREE);
  assert.ok(flat.length > 10);
  assert.ok(flat.every((f) => !/^[a-z]:/i.test(f.node.id)));
});

test('the demo opens its welcome page first, and the sidebar can reopen it', async () => {
  /** @type {any[]} */
  const shown = [];
  /** @type {any[]} */
  const created = [];
  const api = demoApi({ onTab: (t) => shown.push(t) });
  api.tabs.onCreated((/** @type {any} */ t) => created.push(t));
  await api.tabs.restore();
  assert.equal(shown.at(-1).url, WELCOME_URL);
  assert.equal(shown.at(-1).title, 'README.md');
  await api.tabs.restore();
  assert.equal(created.length, 1, 'restore opens it once');
  assert.ok(flatten(TREE).some((f) => f.node.id === WELCOME_ID));
  assert.doesNotMatch(ABOUT_HTML, /<script|\son\w+=/i);
});
