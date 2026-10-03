import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMessage } from '../src/shared/mcp.js';
import { hubIdArg, limitArg, navigationTools, readOnlyTools, tabUrlArg } from '../src/shared/tools.js';
import { searchAll } from '../src/shared/tree.js';

const scan = {
  base: 'D:/work',
  home: 'C:/Users/dev',
  tree: [
    { id: 'app', name: 'app', kind: 'repo', children: [
      { id: 'app/README.md', name: 'README.md', kind: 'md' },
      { id: 'app/docs', name: 'docs', kind: 'folder', children: [{ id: 'app/docs/guide.md', name: 'guide.md', kind: 'md' }] },
    ] },
    { id: '~/notes', name: 'notes', kind: 'userroot', children: [{ id: '~/notes/readme.txt', name: 'readme.txt', kind: 'file' }] },
  ],
};
const marks = { roots: [{ name: 'Bar', children: [{ name: 'Electron docs', url: 'https://www.electronjs.org/docs' }, { name: 'News', url: 'https://news.example' }] }] };
/** @type {import('../src/shared/recent.js').RecentItem[]} */
const recent = [
  { type: 'url', target: 'https://www.electronjs.org/docs', label: 'Electron docs', at: 3 },
  { type: 'terminal', target: 'D:/work/app', label: 'D:/work/app', at: 2 },
  { type: 'file', target: 'app/README.md', label: 'README.md', at: 1 },
];
const tabs = [{ id: 1, url: 'https://example.com/', title: 'Example', loading: false, active: true }];

/** @param {Partial<import('../src/shared/tools.js').Sources>} [over] */
const tools = (over = {}) => readOnlyTools({
  listTabs: () => tabs,
  scan: async () => scan,
  bookmarks: async () => marks,
  recent: () => recent,
  ...over,
});

/** @param {Map<string, any>} t @param {string} name @param {unknown} [args] */
async function call(t, name, args) {
  const res = /** @type {any} */ (await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, t, ''));
  return res.result;
}

test('tools/list offers the three read-only tools with object schemas', async () => {
  const res = /** @type {any} */ (await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, tools(), ''));
  assert.deepEqual(res.result.tools.map((/** @type {any} */ t) => t.name), ['list_tabs', 'sidebar_search', 'recent']);
  for (const t of res.result.tools) assert.equal(t.inputSchema.type, 'object');
});

test('list_tabs returns the open tabs, and an empty list when there are none', async () => {
  assert.deepEqual((await call(tools(), 'list_tabs')).structuredContent, { tabs });
  assert.deepEqual((await call(tools({ listTabs: () => [] }), 'list_tabs', {})).structuredContent, { tabs: [] });
});

test('sidebar_search finds files with absolute paths, bookmarks and recent items', async () => {
  const out = (await call(tools(), 'sidebar_search', { query: '  readme ' })).structuredContent;
  assert.deepEqual(out.files.map((/** @type {any} */ f) => f.path), ['D:/work/app/README.md', 'C:/Users/dev/notes/readme.txt']);
  assert.equal(out.files[0].trail, 'app / README.md');
  assert.deepEqual(out.recent.map((/** @type {any} */ r) => r.target), ['app/README.md']);
  assert.deepEqual(out.errors, []);

  const docs = (await call(tools(), 'sidebar_search', { query: 'electron docs' })).structuredContent;
  assert.deepEqual(docs.bookmarks, [{ name: 'Electron docs', url: 'https://www.electronjs.org/docs', folder: 'Bar / Electron docs' }]);
  assert.equal(docs.recent.length, 1);

  const one = (await call(tools(), 'sidebar_search', { query: 'md', limit: 1 })).structuredContent;
  assert.equal(one.files.length, 1);
  assert.equal((await call(tools(), 'sidebar_search', { query: 'zzz' })).structuredContent.files.length, 0);
});

test('sidebar_search still answers when Hub is down, and says why', async () => {
  const down = tools({ scan: async () => { throw new Error('Project Hub is not reachable'); }, bookmarks: async () => { throw new Error('nope'); } });
  const out = (await call(down, 'sidebar_search', { query: 'electron' })).structuredContent;
  assert.deepEqual(out.files, []);
  assert.deepEqual(out.bookmarks, []);
  assert.equal(out.recent.length, 1);
  assert.deepEqual(out.errors, ['files: Project Hub is not reachable', 'bookmarks: nope']);
  // A scan or bookmark payload missing its arrays is treated as empty.
  const odd = tools({ scan: async () => /** @type {any} */ ({ base: 'D:/work', home: 'C:/Users/dev' }), bookmarks: async () => ({}) });
  assert.deepEqual((await call(odd, 'sidebar_search', { query: 'x' })).structuredContent.errors, []);
});

test('sidebar_search refuses a missing, blank, huge or non-string query and a bad limit', async () => {
  for (const args of [undefined, {}, { query: '   ' }, { query: 42 }, { query: 'x'.repeat(501) }, { query: 'a', limit: 0 }, { query: 'a', limit: 1.5 }, { query: 'a', limit: '5' }]) {
    const res = await call(tools(), 'sidebar_search', args);
    assert.equal(res.isError, true, JSON.stringify(args));
  }
});

test('recent filters by type, limits, and refuses an unknown type', async () => {
  assert.equal((await call(tools(), 'recent')).structuredContent.items.length, 3);
  assert.deepEqual((await call(tools(), 'recent', { type: 'terminal' })).structuredContent.items.map((/** @type {any} */ r) => r.target), ['D:/work/app']);
  assert.equal((await call(tools(), 'recent', { limit: 2 })).structuredContent.items.length, 2);
  assert.equal((await call(tools(), 'recent', { type: 'tab' })).isError, true);
  assert.equal((await call(tools(), 'recent', { limit: 101 })).isError, true);
  assert.deepEqual((await call(tools({ recent: () => [] }), 'recent')).structuredContent.items, []);
});

/** @param {Partial<import('../src/shared/tools.js').Sources>} [over] */
function nav(over = {}) {
  /** @type {any[]} */
  const calls = [];
  const t = navigationTools(/** @type {any} */ ({
    openTab: (/** @type {string} */ url, /** @type {boolean} */ activate) => { calls.push(['tab', url, activate]); return { id: 7 }; },
    openFile: async (/** @type {string} */ id, /** @type {string} */ how) => { calls.push(['file', id, how]); },
    ...over,
  }));
  return { t, calls };
}

test('tools/list on the navigation tools offers open_tab and open_file', async () => {
  const res = /** @type {any} */ (await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, nav().t, ''));
  assert.deepEqual(res.result.tools.map((/** @type {any} */ t) => t.name), ['open_tab', 'open_file']);
  assert.deepEqual(res.result.tools[1].inputSchema.properties.in.enum, ['code', 'reveal']);
});

test('open_tab takes address-bar text, activates unless background, and returns the tab id', async () => {
  const { t, calls } = nav();
  assert.deepEqual((await call(t, 'open_tab', { url: 'example.com' })).structuredContent, { id: 7, url: 'https://example.com' });
  await call(t, 'open_tab', { url: 'D:\\work\\app\\index.html', background: true });
  await call(t, 'open_tab', { url: 'localhost:3000' });
  await call(t, 'open_tab', { url: 'electron docs' });
  assert.deepEqual(calls, [
    ['tab', 'https://example.com', true],
    ['tab', 'file:///D:/work/app/index.html', false],
    ['tab', 'http://localhost:3000', true],
    ['tab', 'https://www.google.com/search?q=electron%20docs', true],
  ]);
});

test('open_tab refuses extension and about: pages, blank or huge input, and a bad background', async () => {
  const { t, calls } = nav();
  for (const args of [undefined, {}, { url: '' }, { url: '   ' }, { url: 42 }, { url: 'x'.repeat(8193) },
    { url: 'about:blank' }, { url: 'chrome-extension://abc/options.html' }, { url: 'https://x.dev', background: 'yes' }]) {
    assert.equal((await call(t, 'open_tab', args)).isError, true, JSON.stringify(args)?.slice(0, 80));
  }
  // javascript: isn't a scheme toUrl keeps, so it becomes a harmless search.
  await call(t, 'open_tab', { url: 'javascript:alert(1)' });
  assert.match(calls[0][1], /^https:\/\/www\.google\.com\/search\?q=javascript/);
  assert.equal(calls.length, 1);
});

test('open_file passes a Hub node id to Hub, in VS Code by default or revealed', async () => {
  const { t, calls } = nav();
  assert.deepEqual((await call(t, 'open_file', { id: 'app/docs/guide.md' })).structuredContent, { opened: 'app/docs/guide.md', in: 'code' });
  await call(t, 'open_file', { id: '~/notes', in: 'reveal' });
  assert.deepEqual(calls, [['file', 'app/docs/guide.md', 'code'], ['file', '~/notes', 'reveal']]);
});

test('open_file refuses paths, escapes, virtual nodes, default-app opens and bad ids', async () => {
  const { t, calls } = nav();
  for (const args of [undefined, {}, { id: '' }, { id: 5 }, { id: 'x'.repeat(1025) }, { id: 'C:/Windows/notepad.exe' },
    { id: '/etc/passwd' }, { id: '\\\\server\\share' }, { id: 'app/../../secret' }, { id: '..\\up' }, { id: '@favorites' },
    { id: 'app/a\u0000b' }, { id: 'app/run.ps1', in: 'default' }, { id: 'app', in: 'explorer' }]) {
    assert.equal((await call(t, 'open_file', args)).isError, true, JSON.stringify(args)?.slice(0, 80));
  }
  assert.deepEqual(calls, []);
});

test('open_file reports Hub refusing or being down as a tool error', async () => {
  const { t } = nav({ openFile: async () => { throw new Error('Project Hub /api/open returned 403'); } });
  const res = await call(t, 'open_file', { id: 'app/README.md' });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /403/);
});

test('tabUrlArg and hubIdArg return what they accept', () => {
  assert.equal(tabUrlArg(' https://x.dev/a '), 'https://x.dev/a');
  assert.equal(hubIdArg('~'), '~');
  assert.equal(hubIdArg('app/v1..2/notes.md'), 'app/v1..2/notes.md');
});

test('limitArg defaults, accepts 1 to 100, refuses the rest', () => {
  assert.equal(limitArg(undefined, 20), 20);
  assert.equal(limitArg(100, 20), 100);
  for (const bad of [0, 101, -1, 2.5, NaN, null, '3']) assert.throws(() => limitArg(bad, 20));
});

test('searchAll: every word must match, empty query matches nothing, limits per group', () => {
  const index = { files: [], bookmarks: [{ name: 'A b', url: 'https://x', path: 'A b' }, { name: 'A', url: 'https://y', path: 'A' }], recent };
  assert.equal(searchAll(index, 'a b').bookmarks.length, 1);
  assert.equal(searchAll(index, '   ').bookmarks.length, 0);
  assert.equal(searchAll(index, '   ').recent.length, 0);
  assert.equal(searchAll(index, 'a', { files: 1, bookmarks: 1, recent: 1 }).bookmarks.length, 1);
});
