// AI Command Center: main process. One BaseWindow holding the shell UI (sidebar, tab
// strip, terminal panel) as a WebContentsView, with a WebContentsView per browser tab
// stacked over the shell's content area.

import { app, BaseWindow, Menu, WebContentsView, ipcMain, net, protocol, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { appendLog, logCrashes, logError } from './applog.js';
import { hub, subscribeHubEvents } from './hub.js';
import { chat } from './chat.js';
import { cronsole } from './cronsole.js';
import { mcpLog, startMcp } from './mcp.js';
import { store } from './store.js';
import { Tabs } from './tabs.js';
import { Terminals } from './terminal.js';
import { installExtension } from 'electron-chrome-web-store';
import { listExtensions, setupExtensions } from './extensions.js';
import { serveDocs, invalidateDocsIndex } from './docs.js';
import { toUrl } from '../shared/url.js';
import { cleanSavedTabs, savedActiveIndex } from '../shared/session.js';
import { cronTools, navigationTools, readOnlyTools, terminalTools } from '../shared/tools.js';
import { Confirmations } from '../shared/confirm.js';
import { menuItems } from '../shared/menu.js';
import { HUB_FAVORITES } from '../shared/tree.js';
import { isPermissionAllowed } from '../shared/permissions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BROWSE_PARTITION = 'persist:browse';
const CONFIRM_TIMEOUT_MS = 5 * 60 * 1000;

// acc://shell/... serves the shell UI. Mapped prefixes only, and every resolved path is
// checked to stay under its folder, so a crafted URL can't read anything else on disk.
const SERVE = [
  ['/vendor/xterm/', path.join(ROOT, 'node_modules', '@xterm', 'xterm')],
  ['/vendor/addon-fit/', path.join(ROOT, 'node_modules', '@xterm', 'addon-fit')],
  ['/shared/', path.join(ROOT, 'src', 'shared')],
  ['/', path.join(ROOT, 'src', 'renderer')],
];

protocol.registerSchemesAsPrivileged([
  { scheme: 'acc', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// One instance: a second launch focuses the first. exit(), not quit(): quit() is async,
// so whenReady would still run and start a second MCP server over the first's mcp.json.
if (!app.requestSingleInstanceLock()) app.exit(0);

/** @type {BaseWindow | null} */
let win = null;
/** @type {WebContentsView | null} */
let shellView = null;
/** @type {Awaited<ReturnType<typeof startMcp>> | null} */
let mcp = null;
const cron = cronsole();
/** @type {(() => void) | null} */
let stopEvents = null;

/** @param {string} channel @param {...unknown} args */
function send(channel, ...args) {
  if (shellView && !shellView.webContents.isDestroyed()) shellView.webContents.send(channel, ...args);
}

function serveShell() {
  protocol.handle('acc', (req) => {
    const url = new URL(req.url);
    if (url.host !== 'shell') return new Response('not found', { status: 404 });
    const pathname = decodeURIComponent(url.pathname);
    for (const [prefix, dir] of SERVE) {
      if (!pathname.startsWith(prefix)) continue;
      const file = path.resolve(dir, pathname.slice(prefix.length) || 'index.html');
      if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) return new Response('not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    }
    return new Response('not found', { status: 404 });
  });
}

/**
 * Accept IPC only from the shell UI. Browser tabs run untrusted pages; they have no
 * preload that exposes these channels, and this check refuses them even if they did.
 * @param {Electron.IpcMainInvokeEvent | Electron.IpcMainEvent} e
 */
function fromShell(e) {
  return shellView !== null && e.sender === shellView.webContents;
}

/**
 * @param {string} channel
 * @param {(...args: any[]) => unknown} fn
 */
function handle(channel, fn) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!fromShell(e)) throw new Error('refused');
    return fn(...args);
  });
}

/** @param {string} channel @param {(...args: any[]) => void} fn */
function on(channel, fn) {
  ipcMain.on(channel, (e, ...args) => { if (fromShell(e)) fn(...args); });
}

function buildMenu() {
  /** @param {string} label @param {string} accelerator @param {string} action */
  const item = (label, accelerator, action) => ({ label, accelerator, click: () => send('shortcut', action) });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        // Ctrl+L and Ctrl+R are left off this menu on purpose: in PowerShell they clear
        // the screen and search history. Browser tabs map them in tabs.js instead.
        item('New tab', 'CmdOrCtrl+T', 'new-tab'),
        item('Close tab', 'CmdOrCtrl+W', 'close-tab'),
        item('Reopen closed tab', 'CmdOrCtrl+Shift+T', 'reopen-tab'),
        item('Focus address bar', 'Alt+D', 'focus-address'),
        { type: 'separator' },
        item('Next tab', 'Ctrl+Tab', 'next-tab'),
        item('Previous tab', 'Ctrl+Shift+Tab', 'prev-tab'),
        // Chrome's rule: Ctrl+1 to Ctrl+8 pick that tab, Ctrl+9 the last.
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => item(`Tab ${n}`, `CmdOrCtrl+${n}`, `tab-${n}`)),
        item('Last tab', 'CmdOrCtrl+9', 'tab-last'),
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        item('Toggle terminal', 'CmdOrCtrl+`', 'toggle-terminal'),
        item('New terminal', 'CmdOrCtrl+Shift+`', 'new-terminal'),
        item('Search everything', 'CmdOrCtrl+Shift+F', 'focus-search'),
        item('Toggle sidebar', 'CmdOrCtrl+B', 'toggle-sidebar'),
        { type: 'separator' },
        item('Reload page', 'F5', 'reload'),
        item('Find in page', 'CmdOrCtrl+F', 'find'),
        item('Zoom in', 'CmdOrCtrl+=', 'zoom-in'),
        { ...item('Zoom in', 'CmdOrCtrl+Plus', 'zoom-in'), visible: false },
        item('Zoom out', 'CmdOrCtrl+-', 'zoom-out'),
        item('Reset zoom', 'CmdOrCtrl+0', 'zoom-reset'),
        item('Page developer tools', 'F12', 'devtools'),
        { label: 'Shell developer tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => shellView?.webContents.toggleDevTools() },
      ],
    },
  ]));
}

async function createWindow() {
  const layout = store.layout();
  win = new BaseWindow({ width: 1500, height: 950, minWidth: 900, minHeight: 600, title: 'AI Command Center', autoHideMenuBar: true, backgroundColor: '#0b0d10' });

  shellView = new WebContentsView({
    webPreferences: {
      preload: path.join(ROOT, 'src', 'preload', 'shell.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // The shell loads only acc://shell files from this repo. Its preload needs
      // require() for <browser-action-list>, which a sandboxed preload can't do.
      sandbox: false,
    },
  });
  win.contentView.addChildView(shellView);
  const fit = () => {
    if (!win || !shellView) return;
    const { width, height } = win.getContentBounds();
    shellView.setBounds({ x: 0, y: 0, width, height });
  };
  win.on('resize', fit);
  fit();

  // Nothing in the shell navigates away or opens windows; links go to tabs.
  shellView.webContents.on('will-navigate', (e) => e.preventDefault());
  shellView.webContents.setWindowOpenHandler(({ url }) => {
    tabs.create(url);
    return { action: 'deny' };
  });

  const browseSession = session.fromPartition(BROWSE_PARTITION);
  // Pages are untrusted: deny every permission but the few in src/shared/permissions.js.
  // Without these handlers Electron grants whatever a page asks for.
  browseSession.setPermissionRequestHandler((_wc, permission, callback) => callback(isPermissionAllowed(permission)));
  browseSession.setPermissionCheckHandler((_wc, permission) => isPermissionAllowed(permission));
  browseSession.setDevicePermissionHandler(() => false);
  serveDocs(browseSession, (url) => cron.page(url));
  // Hub rescans on its own; reload the tree and drop the doc index when it says so.
  stopEvents = subscribeHubEvents(() => {
    invalidateDocsIndex();
    send('hub:changed');
  });
  const tabs = new Tabs({
    window: win,
    session: browseSession,
    send,
    onVisit: (url, title) => send('recent:changed', store.addRecent({ type: 'url', target: url, label: title || url })),
  });
  const terminals = new Terminals(send);

  /** @param {string} id @param {'code' | 'reveal' | 'default'} how @param {string} label */
  const openInHub = async (id, how, label) => {
    await hub.open(id, how);
    send('recent:changed', store.addRecent({ type: 'file', target: id, label }));
  };

  // terminal_run: the shell shows the command and answers with the terminal to type it
  // into, or null. cron_run: the shell shows the task's name and answers true or null.
  // The command and the task id stay here; the answer can't change what runs.
  /** @type {Confirmations<number | true>} */
  const confirmations = new Confirmations({
    show: (ask) => send('mcp:confirm', ask),
    cancel: (id) => send('mcp:cancel', id),
    timeoutMs: CONFIRM_TIMEOUT_MS,
  });

  // The MCP server starts once there are tabs for its tools to look at.
  /** @type {import('../shared/tools.js').Sources} */
  const sources = {
    listTabs: () => tabs.list(),
    readTab: (id) => tabs.text(id),
    scan: () => hub.scan(),
    bookmarks: () => {
      const source = store.layout().bookmarkSource;
      return source === HUB_FAVORITES ? hub.favorites() : hub.webmarks(source || undefined);
    },
    recent: () => store.recent(),
    listTerminals: () => terminals.listSessions(),
    readTerminal: (id) => terminals.read(id),
    openTab: (url, activate) => tabs.create(url, { activate }),
    openFile: (id, how) => openInHub(id, how, id.split('/').pop() || id),
    runCommand: async (command) => {
      const terminal = await confirmations.ask({ command });
      if (terminal === null || !terminals.isPowerShell(terminal)) return null;
      // \r is Enter; PSReadLine takes \n as a continuation line.
      terminals.write(terminal, `${command}\r`);
      return { terminal };
    },
    listCronTasks: () => cron.tasks(),
    runCronTask: async (id) => {
      const task = (await cron.tasks()).find((t) => t.id === id);
      if (!task) throw new Error(`Cronsole has no task with id ${id}`);
      if (await confirmations.ask({ task: task.name }) !== true) return null;
      return cron.run(id);
    },
  };
  const callLog = mcpLog(send);
  handle('mcp:log', () => callLog.entries);
  // Terminals get the address and token, so `claude` in one can reach the app (README,
  // "Drive the app from Claude Code"). The shell loads after this, so even the first has them.
  const mcpReady = startMcp(new Map([...readOnlyTools(sources), ...navigationTools(sources), ...terminalTools(sources), ...cronTools(sources)]), (e) => callLog.add(e))
    .then((m) => {
      mcp = m;
      terminals.env = { ACC_MCP_URL: m.url, ACC_MCP_TOKEN: m.token };
      console.log(`[mcp] listening on ${m.url}`);
    })
    .catch((err) => console.error('[mcp] failed to start; the app runs without it:', err));

  // The chat panel: Claude with this app's MCP server as its tools.
  const conversation = chat({ mcp: () => mcp, send, load: store.chat, save: store.saveChat });
  handle('chat:info', () => conversation.info());
  handle('chat:send', (text, attach) => conversation.send(text, attach));
  handle('chat:reset', () => conversation.reset());

  // Cronsole: its task list through its own MCP server, its UI in a pinned tab.
  handle('cronsole:info', () => cron.info());
  handle('cronsole:tasks', () => cron.tasks());
  handle('cronsole:history', (taskId) => cron.history(taskId));

  handle('app:info', () => ({
    hubUrl: hub.url,
    quickLinks: store.settings().quickLinks,
    versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
    shell: terminals.shell,
    shells: terminals.list(),
    layout,
    browsePartition: BROWSE_PARTITION,
  }));
  handle('layout:save', (patch) => store.saveLayout(patch));

  handle('hub:health', () => hub.health());
  handle('hub:scan', (fresh) => hub.scan(Boolean(fresh)));
  handle('hub:webmarks', (source) => hub.webmarks(typeof source === 'string' ? source : undefined));
  handle('hub:favorites', () => hub.favorites());
  handle('hub:favorite', (url, name) => hub.favorite(String(url || ''), String(name || url || '')));
  handle('hub:open', (id, how, label) => openInHub(String(id), how === 'reveal' ? 'reveal' : how === 'default' ? 'default' : 'code', String(label || id)));

  handle('tabs:create', (input) => tabs.create(toUrl(String(input || 'about:blank'))).id);
  handle('tabs:activate', (id) => tabs.activate(Number(id)));
  handle('tabs:close', (id) => tabs.close(Number(id)));
  handle('tabs:navigate', (input) => tabs.navigate(toUrl(String(input))));
  handle('tabs:command', (action) => tabs.command(action));
  // Electron's findNext means "start a new session": true as the text changes, false to step.
  handle('tabs:find', (text, forward, newSession) => tabs.find(String(text).slice(0, 1000), { forward: forward !== false, findNext: Boolean(newSession) }));
  handle('tabs:stopFind', () => tabs.stopFind());
  on('tabs:bounds', (rect) => tabs.setBounds(rect));
  on('tabs:hidden', (hidden) => tabs.setHidden(Boolean(hidden)));
  // The shell asks once its tab listeners are wired. The smoke run neither restores
  // nor saves, so it can't disturb the real profile's tabs.
  let restored = Boolean(process.env.ACC_SMOKE_DIR);
  handle('tabs:restore', () => {
    if (restored) return;
    restored = true;
    const created = layout.tabs.map((url) => tabs.create(url, { activate: false }));
    const i = savedActiveIndex(layout.activeTab, created.length);
    if (i >= 0) tabs.activate(created[i].id);
  });
  handle('tabs:openExternal', (url) => {
    const u = String(url);
    if (/^https?:/i.test(u)) return shell.openExternal(u);
  });

  handle('term:create', (opts) => {
    const t = terminals.create(opts || {});
    send('recent:changed', store.addRecent({ type: 'terminal', target: t.cwd, label: t.cwd }));
    return t;
  });
  on('term:write', (id, data) => terminals.write(Number(id), data));
  on('term:active', (id) => { terminals.activeId = Number.isInteger(id) ? id : null; });
  on('term:resize', (id, cols, rows) => terminals.resize(Number(id), cols, rows));
  handle('term:kill', (id) => terminals.kill(Number(id)));

  handle('mcp:answer', (id, answer) => confirmations.settle(Number(id), answer === true ? true : Number.isInteger(answer) ? answer : null));

  // A native menu, so it draws over the browser view instead of under it.
  handle('menu:popup', (items) => new Promise((resolve) => {
    const template = menuItems(items).map((i) => (i === '-'
      ? { type: /** @type {const} */ ('separator') }
      : { label: i.label, click: () => resolve(i.id) }));
    // ponytail: on Windows the close callback can fire before the click, so give the
    // click a moment to win; a picked item always resolves first if it fires at all.
    Menu.buildFromTemplate(template).popup({ callback: () => setTimeout(() => resolve(null), 100) });
  }));

  handle('recent:list', () => store.recent());
  handle('recent:add', (item) => store.addRecent(item));

  handle('ext:list', () => listExtensions(browseSession));

  win.on('close', () => {
    if (process.env.ACC_SMOKE_DIR) return;
    const { urls, active } = tabs.snapshot();
    const kept = cleanSavedTabs(urls);
    // Dropped entries (blank pages) shift the index; point it at the same URL if kept.
    store.saveLayout({ tabs: kept, activeTab: active >= 0 ? kept.indexOf(urls[active]) : -1 });
  });
  win.on('closed', () => {
    terminals.killAll();
    win = null;
    shellView = null;
  });

  // Extensions before the shell loads, so <browser-action-list> finds them on first paint.
  try {
    await setupExtensions({ browseSession, shellSession: shellView.webContents.session, window: win, tabs });
  } catch (err) {
    console.error('[extensions] setup failed; browsing still works without them:', err);
  }

  if (process.env.ACC_SMOKE_DIR) smoke(process.env.ACC_SMOKE_DIR, tabs, terminals, browseSession);
  await mcpReady;
  await shellView.webContents.loadURL('acc://shell/index.html');
}

/**
 * `npm run smoke`: forward the shell's console to stdout, open one page, and save
 * screenshots of the shell and the page, then quit. See scripts/smoke.js.
 * @param {string} dir
 * @param {Tabs} tabs
 * @param {Terminals} terminals
 * @param {Electron.Session} browseSession
 */
function smoke(dir, tabs, terminals, browseSession) {
  const wc = /** @type {WebContentsView} */ (shellView).webContents;
  wc.on('console-message', (e) => console.log(`[shell:${e.level}] ${e.message}`));
  wc.on('preload-error', (_e, p, err) => console.log(`[shell:preload-error] ${p}: ${err.message}`));
  // Extension service workers log here, not to any page; the extension spike needs it.
  browseSession.serviceWorkers.on('console-message', (_e, d) => console.log(`[sw:${d.level}] ${d.sourceUrl}:${d.lineNumber} ${String(d.message).slice(0, 300)}`));
  wc.once('did-finish-load', async () => {
    const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
    await wait(4000);
    // ACC_SMOKE_INSTALL=<id>,<id>: install Web Store extensions first (the extension spike).
    for (const id of (process.env.ACC_SMOKE_INSTALL || '').split(',').filter(Boolean)) {
      try {
        const ext = await installExtension(id, { session: browseSession });
        console.log(`[smoke] installed ${id}: ${ext?.name} ${ext?.version} (MV${ext?.manifest?.manifest_version})`);
      } catch (err) {
        console.log(`[smoke] install ${id} FAILED: ${err instanceof Error ? err.message : err}`);
      }
    }
    const tab = tabs.create(process.env.ACC_SMOKE_URL || 'https://example.com');
    await wait(Number(process.env.ACC_SMOKE_WAIT_MS || 16000));
    // Drive the sidebar the way a person would: expand the first root, then search.
    const checks = await wc.executeJavaScript(`(async () => {
      const first = document.querySelector('#panel-files .row');
      first?.click();
      const expanded = document.querySelectorAll('#panel-files .row').length;
      const s = document.getElementById('search');
      s.value = 'README';
      s.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 500));
      const results = document.querySelectorAll('#panel-search .row').length;
      const groups = [...document.querySelectorAll('#panel-search .group-title')].map((g) => g.textContent);
      const terminals = document.querySelectorAll('.term-tab').length;
      return { expandedRows: expanded, searchResults: results, groups, terminals, hubDot: document.getElementById('hub-status').className };
    })()`);
    console.log(`[smoke] shell checks=${JSON.stringify(checks)}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tab.png'), (await tab.view.webContents.capturePage()).toPNG());
    console.log(`[smoke] tab url=${tab.view.webContents.getURL()} title=${tab.view.webContents.getTitle()}`);
    console.log(`[smoke] tab bounds=${JSON.stringify(tab.view.getBounds())}`);
    console.log(`[smoke] extensions=${JSON.stringify(listExtensions(browseSession))}`);
    // The MCP server as a client would find it: no token must fail, the file's token must work.
    try {
      const { url, token } = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'mcp.json'), 'utf8'));
      const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
      const without = (await fetch(url, { method: 'POST', body })).status;
      const withToken = (await fetch(url, { method: 'POST', body, headers: { Authorization: `Bearer ${token}` } })).status;
      console.log(`[smoke] mcp ${url} without-token=${without} with-token=${withToken}`);
      const call = (/** @type {string} */ name, /** @type {object} */ args) => fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }),
      }).then((r) => r.json()).then((r) => r.result?.structuredContent ?? r);
      const opened = await call('open_tab', { url: 'example.org', background: true });
      console.log(`[smoke] mcp open_tab=${JSON.stringify(opened)}`);
      const listed = await call('list_tabs', {});
      const found = await call('sidebar_search', { query: 'README', limit: 5 });
      const recent = await call('recent', { limit: 3 });
      console.log(`[smoke] mcp list_tabs=${JSON.stringify(listed)}`);
      console.log(`[smoke] mcp sidebar_search files=${found.files?.length} bookmarks=${found.bookmarks?.length} recent=${found.recent?.length} errors=${JSON.stringify(found.errors)}`);
      console.log(`[smoke] mcp recent items=${recent.items?.length}`);
      // terminal_run waits on the confirm bar; click Run the way a person would.
      // Prints the URL the terminal was given, so shell.png shows ACC_MCP_URL arrived.
      const ran = call('terminal_run', { command: 'Write-Output "acc-smoke $env:ACC_MCP_URL"' });
      await wait(500);
      const shown = await wc.executeJavaScript(`(() => {
        const bar = document.getElementById('confirm-bar');
        const text = bar.hidden ? null : document.getElementById('confirm-cmd').textContent;
        document.getElementById('confirm-run').click();
        return text;
      })()`);
      console.log(`[smoke] mcp terminal_run bar=${JSON.stringify(shown)} result=${JSON.stringify(await ran)}`);
      // The loop closed: the terminal's output and the page's text, read back.
      await wait(1500);
      const sessions = await call('list_terminals', {});
      const output = await call('terminal_read', { lines: 5 });
      console.log(`[smoke] mcp list_terminals=${JSON.stringify(sessions)}`);
      console.log(`[smoke] mcp terminal_read terminal=${output.terminal} text=${JSON.stringify(output.text?.slice(-200))}`);
      console.log(`[smoke] terminal raw tail=${JSON.stringify(terminals.read()?.raw?.slice(-400))}`);
      const page = await call('read_tab', { tab: tab.view.webContents.id });
      console.log(`[smoke] mcp read_tab title=${JSON.stringify(page.title)} chars=${page.text?.length} truncated=${page.truncated} start=${JSON.stringify(page.text?.slice(0, 60))}`);
      // cron_tasks answers with the list, or says what to set when Cronsole isn't configured.
      const cronOut = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'cron_tasks', arguments: {} } }),
      }).then((r) => r.json());
      console.log(`[smoke] mcp cron_tasks tasks=${cronOut.result?.structuredContent?.tasks?.length ?? null} error=${JSON.stringify(cronOut.result?.isError ? cronOut.result.content?.[0]?.text?.slice(0, 80) : null)}`);
      // Find in page on example.com: type a word and read the match count.
      tabs.activate(tab.id);
      const finder = await wc.executeJavaScript(`(async () => {
        document.getElementById('find-form').hidden = false;
        const i = document.getElementById('find-input');
        i.value = 'domain';
        i.dispatchEvent(new Event('input'));
        await new Promise((r) => setTimeout(r, 800));
        const count = document.getElementById('find-count').textContent;
        document.getElementById('find-close').click();
        return { count, hidden: document.getElementById('find-form').hidden };
      })()`);
      console.log(`[smoke] find=${JSON.stringify(finder)}`);
    } catch (err) {
      console.log(`[smoke] mcp FAILED: ${err instanceof Error ? err.message : err}`);
    }
    // The shell menu's profiles, a non-PowerShell session, and a Files click landing
    // on a document page (the right-click menu itself is native and needs a person).
    const shellChecks = await wc.executeJavaScript(`(async () => {
      const shells = (await window.acc.info()).shells.map((s) => s.id);
      const cmd = await window.acc.term.create({ shell: 'cmd' });
      await window.acc.term.kill(cmd.id);
      const md = [...document.querySelectorAll('#panel-search .row')].find((r) => /\\.md$/i.test(r.querySelector('.name')?.textContent || ''));
      md?.click();
      return { shells, cmd: [cmd.shell, cmd.powershell], clicked: md?.querySelector('.name')?.textContent ?? null };
    })()`);
    await wait(3000);
    console.log(`[smoke] shells=${JSON.stringify(shellChecks)} tabs=${JSON.stringify(tabs.list().map((t) => t.url))}`);
    const doc = tabs.list().find((t) => t.url.startsWith('acc://doc/'));
    const docTab = doc && tabs.tabs.get(doc.id);
    if (docTab) {
      const page = await docTab.view.webContents.executeJavaScript(
        `({ title: document.title, headings: document.querySelectorAll('h1, h2').length, images: [...document.images].map((i) => [i.src.slice(0, 60), i.naturalWidth]).slice(0, 3), sidebar: Boolean(document.querySelector('aside, nav#sidebar')) })`);
      console.log(`[smoke] doc page=${JSON.stringify(page)}`);
      fs.writeFileSync(path.join(dir, 'doc.png'), (await docTab.view.webContents.capturePage()).toPNG());
    }
    // The MCP calls above, in the sidebar's MCP panel and at the end of mcp.log.
    const panel = await wc.executeJavaScript(`[...document.querySelectorAll('#panel-mcp .row .name')].map((n) => n.textContent.split(' ')[0]).slice(0, 8)`);
    const logged = fs.readFileSync(path.join(app.getPath('userData'), 'logs', 'mcp.log'), 'utf8').trim().split('\n').slice(-8)
      .map((l) => { const e = JSON.parse(l); return `${e.tool || e.method}:${e.ok ? 'ok' : e.status || 'err'}`; });
    console.log(`[smoke] mcp log panel=${JSON.stringify(panel)} file=${JSON.stringify(logged)}`);
    // The Chat tab: what it tells the user (model and missing variables only; the key never leaves main).
    const chatPanel = await wc.executeJavaScript(`(async () => {
      const s = document.getElementById('search');
      s.value = '';
      s.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 300));
      document.querySelector('.side-tabs [data-panel="chat"]').click();
      const page = document.getElementById('chat-attach-page');
      page.click();
      const attach = page.getAttribute('aria-pressed');
      page.click();
      return { info: await window.acc.chat.info(), attach, shown: document.getElementById('chat-log').textContent.slice(0, 160) };
    })()`);
    console.log(`[smoke] chat=${JSON.stringify(chatPanel)}`);
    // The Cron tab (Cronsole's tasks through its MCP server, when ACC_CRONSOLE_MCP is set):
    // the first task with recorded runs unfolds them and its newest opens as an acc://run
    // page; then Open Cronsole twice: one pinned tab, first in the strip, reused.
    const cronPanel = await wc.executeJavaScript(`(async () => {
      document.querySelector('.side-tabs [data-panel="cron"]').click();
      for (let i = 0; i < 60 && /Asking/.test(document.getElementById('cron-list').textContent); i++) await new Promise((r) => setTimeout(r, 500));
      const rows = [...document.querySelectorAll('#cron-list .row.task')];
      let runs = [];
      let runsNote = null;
      for (const row of rows.filter((r) => /Last run:/.test(r.title)).slice(0, 8)) {
        row.click();
        for (let i = 0; i < 40 && /Asking/.test(row.nextElementSibling?.textContent || ''); i++) await new Promise((r) => setTimeout(r, 250));
        runs = [...(row.nextElementSibling?.querySelectorAll('.row.run') || [])];
        if (runs.length) break;
        runsNote ??= row.nextElementSibling?.textContent.slice(0, 120) ?? null;
        row.click();
      }
      runs[0]?.click();
      await new Promise((r) => setTimeout(r, 2000));
      document.getElementById('cron-open').click();
      await new Promise((r) => setTimeout(r, 1500));
      document.getElementById('cron-open').click();
      await new Promise((r) => setTimeout(r, 500));
      const pinned = document.querySelectorAll('#tab-list .tab.pinned');
      return {
        info: await window.acc.cronsole.info(),
        tasks: rows.length,
        first: rows.slice(0, 3).map((r) => r.querySelector('.name').textContent + ' · ' + r.querySelector('.sub').textContent),
        note: rows.length ? null : document.getElementById('cron-list').textContent.slice(0, 200),
        runs: runs.slice(0, 2).map((r) => r.querySelector('.name').textContent),
        runsNote: runs.length ? null : runsNote,
        pinnedTabs: pinned.length,
        pinnedFirst: document.querySelector('#tab-list .tab') === pinned[0],
      };
    })()`);
    console.log(`[smoke] cronsole=${JSON.stringify(cronPanel)} tabs=${JSON.stringify(tabs.list().map((t) => t.url))}`);
    const run = tabs.list().find((t) => t.url.startsWith('acc://run/'));
    const runTab = run && tabs.tabs.get(run.id);
    if (runTab) {
      const page = await runTab.view.webContents.executeJavaScript(
        `({ title: document.title, facts: document.querySelector('.note')?.textContent, output: document.querySelector('pre')?.textContent.length ?? null, none: /no output/.test(document.body.textContent) })`);
      console.log(`[smoke] run page=${JSON.stringify(page)}`);
    }
    // Last, so it shows terminal_run's output in the terminal.
    await wait(1500);
    fs.writeFileSync(path.join(dir, 'shell.png'), (await wc.capturePage()).toPNG());
    console.log(`[smoke] screenshots in ${dir}`);
    app.quit();
  });
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

logCrashes();
app.whenReady().then(() => {
  serveShell();
  buildMenu();
  return createWindow();
}).catch((err) => {
  logError('startup', err);
  app.exit(1);
});

app.on('window-all-closed', () => app.quit());

// node-pty's ConPTY output reader runs on a worker thread that outlives its session, so
// the process reaches 'quit' and then never exits. Every window is closed and every
// terminal killed by this point (win 'closed'), so exit explicitly.
app.on('quit', () => {
  mcp?.close();
  cron.close();
  stopEvents?.();
  setImmediate(() => app.exit(0));
});
