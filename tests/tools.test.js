import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMessage } from '../src/shared/mcp.js';
import { commandArg, cronTools, hubIdArg, limitArg, navigationTools, readOnlyTools, tabUrlArg, terminalTools } from '../src/shared/tools.js';
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

test('tools/list offers the four read-only tools with object schemas', async () => {
  const res = /** @type {any} */ (await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, tools(), ''));
  assert.deepEqual(res.result.tools.map((/** @type {any} */ t) => t.name), ['list_tabs', 'sidebar_search', 'read_tab', 'recent']);
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

/** @param {(command: string) => Promise<{ terminal: number } | null>} runCommand */
function term(runCommand) {
  /** @type {string[]} */
  const asked = [];
  const t = terminalTools(/** @type {any} */ ({ runCommand: (/** @type {string} */ c) => { asked.push(c); return runCommand(c); } }));
  return { t, asked };
}

test('terminal_run asks with the trimmed command and reports the terminal it ran in', async () => {
  const { t, asked } = term(async () => ({ terminal: 3 }));
  const res = await call(t, 'terminal_run', { command: '  git status; npm test  ' });
  assert.deepEqual(res.structuredContent, { ran: true, terminal: 3, command: 'git status; npm test' });
  assert.deepEqual(asked, ['git status; npm test']);
});

test('terminal_run is a tool error when the user denies or does not answer', async () => {
  const { t } = term(async () => null);
  const res = await call(t, 'terminal_run', { command: 'Remove-Item x' });
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /denied/);
});

test('terminal_run refuses multi-line, hidden-character, oversized and non-string commands without asking', async () => {
  const { t, asked } = term(async () => ({ terminal: 1 }));
  for (const args of [undefined, {}, { command: '' }, { command: '   ' }, { command: 5 }, { command: 'x'.repeat(4097) },
    { command: 'ls\nrm -r ~' }, { command: 'ls\rrm' }, { command: 'ls\tx' }, { command: 'echo \u001b[2Jhi' },
    { command: 'echo safe \u202e;txt.exe' }, { command: 'ls\u200b' }]) {
    assert.equal((await call(t, 'terminal_run', args)).isError, true, JSON.stringify(args)?.slice(0, 80));
  }
  assert.deepEqual(asked, []);
});

test('tabUrlArg and hubIdArg return what they accept', () => {
  assert.equal(tabUrlArg(' https://x.dev/a '), 'https://x.dev/a');
  assert.equal(hubIdArg('~'), '~');
  assert.equal(hubIdArg('app/v1..2/notes.md'), 'app/v1..2/notes.md');
  assert.equal(commandArg("Get-ChildItem 'D:\work' | Select-Object -First 5"), "Get-ChildItem 'D:\work' | Select-Object -First 5");
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

// ---- read_tab, list_terminals, terminal_read --------------------------------

test('read_tab returns the active tab or the one asked for, clipped, and refuses bad ids', async () => {
  const long = 'x'.repeat(1500);
  const t = tools({
    readTab: async (id) => {
      if (id === 7) throw new Error('No tab with id 7');
      return { id: id ?? 1, url: 'https://example.com/', title: 'Example', text: long };
    },
  });
  const out = (await call(t, 'read_tab', {})).structuredContent;
  assert.deepEqual(out, { id: 1, url: 'https://example.com/', title: 'Example', text: long, truncated: false });
  const clipped = (await call(t, 'read_tab', { tab: 2, max_chars: 1000 })).structuredContent;
  assert.equal(clipped.id, 2);
  assert.equal(clipped.text.length, 1000);
  assert.equal(clipped.truncated, true);
  for (const args of [{ tab: 7 }, { tab: 0 }, { tab: 'a' }, { max_chars: 10 }, { max_chars: 1e6 }]) {
    const res = await call(t, 'read_tab', args);
    assert.equal(res.isError, true, JSON.stringify(args));
  }
});

test('list_terminals and terminal_read read the showing terminal or a named one, cleaned, last N lines', async () => {
  const sessions = [
    { id: 1, shell: 'pwsh.exe', profile: 'pwsh', cwd: 'D:/work', powershell: true, exited: false, active: false },
    { id: 2, shell: 'cmd.exe', profile: 'cmd', cwd: 'D:/work', powershell: false, exited: true, active: true },
  ];
  const raw = { 1: '\x1b[32mPS>\x1b[0m npm test\r\n1 passing\r\n', 2: 'a\r\nb\r\nc\r\n\r\n' };
  const t = terminalTools(/** @type {any} */ ({
    listTerminals: () => sessions,
    readTerminal: (id) => {
      const pick = id ?? 2;
      return pick in raw ? { id: pick, raw: raw[/** @type {1 | 2} */ (pick)] } : null;
    },
    runCommand: async () => null,
  }));
  assert.deepEqual((await call(t, 'list_terminals', {})).structuredContent, { terminals: sessions });
  assert.deepEqual((await call(t, 'terminal_read', {})).structuredContent, { terminal: 2, text: 'a\nb\nc' });
  assert.deepEqual((await call(t, 'terminal_read', { terminal: 1 })).structuredContent, { terminal: 1, text: 'PS> npm test\n1 passing' });
  assert.deepEqual((await call(t, 'terminal_read', { terminal: 2, lines: 1 })).structuredContent, { terminal: 2, text: 'c' });
  for (const args of [{ terminal: 9 }, { terminal: 0 }, { terminal: '1' }, { lines: 0 }, { lines: 501 }, { lines: 1.5 }]) {
    assert.equal((await call(t, 'terminal_read', args)).isError, true, JSON.stringify(args));
  }
  const none = terminalTools(/** @type {any} */ ({ listTerminals: () => [], readTerminal: () => null, runCommand: async () => null }));
  assert.match((await call(none, 'terminal_read', {})).content[0].text, /No terminal is open/);
});

// ---- cron_tasks, cron_run ------------------------------------------------------

test('cron_tasks lists Cronsole tasks and surfaces a missing setup as a tool error', async () => {
  const task = { id: 't1', name: 'Nightly', platform: 'TASKHUB_NATIVE', schedule: null, status: 'ACTIVE', nextRunTime: null, lastRunStatus: null, lastRunAt: null };
  const t = cronTools(/** @type {any} */ ({ listCronTasks: async () => [task], runCronTask: async () => null }));
  assert.deepEqual((await call(t, 'cron_tasks', {})).structuredContent, { tasks: [task] });
  const off = cronTools(/** @type {any} */ ({ listCronTasks: async () => { throw new Error('Set ACC_CRONSOLE_MCP'); }, runCronTask: async () => null }));
  const res = await call(off, 'cron_tasks', {});
  assert.equal(res.isError, true);
  assert.match(res.content[0].text, /ACC_CRONSOLE_MCP/);
});

test('cron_run asks with the task id, returns the run result, and is a tool error when denied or refused', async () => {
  /** @type {string[]} */
  const asked = [];
  const t = cronTools(/** @type {any} */ ({
    listCronTasks: async () => [],
    runCronTask: async (/** @type {string} */ id) => {
      asked.push(id);
      if (id === 'deny') return null;
      if (id === 'missing') throw new Error('Cronsole has no task with id missing');
      return { ran: true, success: true };
    },
  }));
  assert.deepEqual((await call(t, 'cron_run', { task: ' t1 ' })).structuredContent, { ran: true, task: 't1', result: { ran: true, success: true } });
  assert.match((await call(t, 'cron_run', { task: 'deny' })).content[0].text, /denied/);
  assert.match((await call(t, 'cron_run', { task: 'missing' })).content[0].text, /no task/);
  assert.deepEqual(asked, ['t1', 'deny', 'missing']);
  for (const args of [undefined, {}, { task: '' }, { task: 3 }, { task: 'a\nb' }, { task: 'x'.repeat(201) }]) {
    assert.equal((await call(t, 'cron_run', args)).isError, true, JSON.stringify(args));
  }
  assert.equal(asked.length, 3);
});

// ---- annotations ---------------------------------------------------------------

test('tools/list annotates every tool: only the click-gated ones act, and they say they can do anything', async () => {
  const all = new Map([
    ...readOnlyTools(/** @type {any} */ ({})), ...navigationTools(/** @type {any} */ ({})),
    ...terminalTools(/** @type {any} */ ({})), ...cronTools(/** @type {any} */ ({})),
  ]);
  const res = /** @type {any} */ (await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, all, ''));
  /** @type {Record<string, any>} */
  const by = Object.fromEntries(res.result.tools.map((/** @type {any} */ t) => [t.name, t.annotations]));
  assert.equal(Object.keys(by).length, 11);
  for (const [name, a] of Object.entries(by)) {
    for (const hint of ['readOnlyHint', 'destructiveHint', 'openWorldHint']) assert.equal(typeof a?.[hint], 'boolean', `${name}.${hint}`);
  }
  const acting = Object.keys(by).filter((n) => !by[n].readOnlyHint).sort();
  assert.deepEqual(acting, ['cron_run', 'open_file', 'open_tab', 'terminal_run']);
  assert.deepEqual(Object.keys(by).filter((n) => by[n].destructiveHint).sort(), ['cron_run', 'terminal_run']);
  for (const n of ['read_tab', 'open_tab', 'terminal_run', 'cron_run']) assert.equal(by[n].openWorldHint, true, n);
  assert.equal(by.list_tabs.openWorldHint, false);
});
