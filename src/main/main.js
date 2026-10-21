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
import { extensionsMenu, listExtensions, setupExtensions } from './extensions.js';
import { loadBlocker } from './adblock.js';
import { smoke } from './smoke.js';
import { serveDocs, invalidateDocsIndex } from './docs.js';
import { toUrl } from '../shared/url.js';
import { cleanSavedTabs, savedActiveIndex } from '../shared/session.js';
import { cronTools, navigationTools, readOnlyTools, terminalTools } from '../shared/tools.js';
import { Confirmations, isFreshRunTarget } from '../shared/confirm.js';
import { menuItems } from '../shared/menu.js';
import { HUB_FAVORITES } from '../shared/tree.js';
import { isPermissionAllowed } from '../shared/permissions.js';
import { addWorkspace, drivePath, removeWorkspace, saveWorkspace, workspaceSummary } from '../shared/workspaces.js';
import { chatRow, cronsoleRow, hubRow, mcpRow, shellRows } from '../shared/connections.js';

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

// ACC_USER_DATA: run on another profile (npm run smoke's throwaway one). Before the
// single-instance lock, which is per profile, so a smoke run works beside the real app.
if (process.env.ACC_USER_DATA) app.setPath('userData', process.env.ACC_USER_DATA);

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
  // The shell's main frame on acc://shell, not just its webContents: a subframe can't speak for it.
  return shellView !== null && e.sender === shellView.webContents
    && e.senderFrame === shellView.webContents.mainFrame && Boolean(e.senderFrame?.url.startsWith('acc://shell/'));
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

/** @param {Electron.MenuItemConstructorOptions[]} [extensions] the Extensions submenu, once they're set up */
function buildMenu(extensions = [{ label: 'Loading…', enabled: false }]) {
  /** @param {string} label @param {string | undefined} accelerator @param {string} action */
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
        item('Command palette', 'CmdOrCtrl+K', 'palette'),
        item('Connections', undefined, 'connections'),
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
    { label: 'Extensions', submenu: extensions },
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

  // Workspaces (workspaces.json): switching swaps the tabs and the conversation, and shows
  // that workspace's terminals. Terminals keep running while hidden; a workspace's saved
  // folders open as fresh shells, so a switch never re-runs a command.
  let spaces = store.workspaces();
  /** Workspaces shown this run: their saved terminal folders follow the live ones. */
  const visited = new Set([spaces.active]);
  const current = () => spaces.list.find((w) => w.id === spaces.active) ?? spaces.list[0];
  // The smoke run neither restores nor saves, so it can't disturb the real profile.
  const persistSpaces = () => { if (!process.env.ACC_SMOKE_DIR) store.saveWorkspaces(spaces); };
  persistSpaces();
  /** Fold the open tabs and this run's terminal folders into the saved state. */
  const snapshot = () => {
    const { urls, active } = tabs.snapshot();
    const kept = cleanSavedTabs(urls);
    // Dropped entries (blank pages) shift the index; point it at the same URL if kept.
    spaces = saveWorkspace(spaces, spaces.active, { tabs: kept, activeTab: active >= 0 ? kept.indexOf(urls[active]) : -1 });
    for (const id of visited) spaces = saveWorkspace(spaces, id, { terminals: terminals.folders(id) });
  };
  /** @param {import('../shared/workspaces.js').Workspace} w */
  const openTabs = (w) => {
    const created = w.tabs.map((url) => tabs.create(url, { activate: false }));
    const i = savedActiveIndex(w.activeTab, created.length);
    if (i >= 0) tabs.activate(created[i].id);
  };
  /** What the shell gets: the list, and the active one's folder and terminal folders. */
  const workspaceInfo = () => {
    const w = current();
    return { ...workspaceSummary(spaces), folder: w.folder, terminals: w.terminals, live: terminals.folders(w.id).length > 0 };
  };
  /** @param {string} id */
  const switchTo = (id) => {
    if (id === spaces.active) return workspaceInfo();
    if (!spaces.list.some((w) => w.id === id)) throw new Error(`No workspace ${id}`);
    if (conversation.busy) throw new Error('Wait for the chat to answer, or press Stop, before switching.');
    snapshot();
    spaces = { ...spaces, active: id };
    visited.add(id);
    persistSpaces();
    tabs.closeAll();
    openTabs(current());
    conversation.reload();
    const out = workspaceInfo();
    send('workspace:changed', out);
    return out;
  };
  handle('workspace:info', () => workspaceInfo());
  handle('workspace:switch', (id) => switchTo(String(id)));
  handle('workspace:add', (input) => {
    const { folder, name, hubId } = input && typeof input === 'object' ? input : {};
    const dir = drivePath(folder);
    if (!dir || !fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Not a folder: ${folder}`);
    const added = addWorkspace(spaces, { folder: dir, name, hubId });
    spaces = added.state;
    persistSpaces();
    return switchTo(added.id);
  });
  handle('workspace:remove', (id) => {
    const target = String(id);
    if (target === spaces.active) switchTo(spaces.list[0].id);
    spaces = removeWorkspace(spaces, target);
    visited.delete(target);
    store.clearChat(target);
    persistSpaces();
    const out = workspaceInfo();
    send('workspace:changed', out);
    return out;
  });

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
    // The command and folder are fixed here, before the bar shows them. The shell opens a
    // new PowerShell terminal there on Run and answers with its id; anything but that
    // fresh terminal refuses (isFreshRunTarget), so the approval can't change target.
    runCommand: async (command, cwd, signal) => {
      const dir = cwd ?? terminals.defaultFolder(current().folder);
      if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`cwd is not a folder: ${dir}`);
      const sinceId = terminals.nextId;
      const terminal = await confirmations.ask({ command, cwd: dir }, signal);
      if (typeof terminal !== 'number' || !isFreshRunTarget(terminals.info(terminal), { sinceId, cwd: dir })) return null;
      // \r is Enter; PSReadLine takes \n as a continuation line.
      terminals.write(terminal, `${command}\r`);
      return { terminal, cwd: dir };
    },
    listCronTasks: () => cron.tasks(),
    runCronTask: async (id, signal) => {
      const task = (await cron.tasks()).find((t) => t.id === id);
      if (!task) throw new Error(`Cronsole has no task with id ${id}`);
      if (await confirmations.ask({ task: task.name }, signal) !== true) return null;
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
  const conversation = chat({
    mcp: () => mcp,
    send,
    load: () => store.chat(spaces.active),
    save: (m) => store.saveChat(spaces.active, m),
    clear: () => store.clearChat(spaces.active),
  });
  handle('chat:info', () => conversation.info());
  handle('chat:attach', (kind) => conversation.attach(kind));
  handle('chat:send', (text, ids) => conversation.send(text, ids));
  handle('chat:reset', () => conversation.reset());
  handle('chat:stop', () => conversation.stop());

  // Cronsole: its task list through its own MCP server, its UI in a pinned tab.
  handle('cronsole:info', () => cron.info());
  handle('cronsole:tasks', () => cron.tasks());
  handle('cronsole:history', (taskId) => cron.history(taskId));

  // The Connections view: Hub, Cronsole, each shell, the chat model and the MCP server.
  // Given a row's id it checks that one again (Retry), given a group ('shells') every row in it, and with none, all of them.
  handle('connections:check', async (id) => {
    const want = (/** @type {string} */ key) => !id || id === key || (key === 'shells' && String(id).startsWith('shell:'));
    const cronRow = async () => {
      const info = cron.info();
      if (!info.configured) return cronsoleRow(info, null);
      try {
        return cronsoleRow(info, { count: (await cron.tasks()).length });
      } catch (err) {
        return cronsoleRow(info, { error: err instanceof Error ? err.message : String(err) });
      }
    };
    const groups = await Promise.all([
      want('hub') ? hub.health().then((h) => [hubRow(hub.url, h)]) : [],
      want('cronsole') ? cronRow().then((r) => [r]) : [],
      want('shells') ? shellRows(terminals.rescanShells()) : [],
      want('chat') ? [chatRow(conversation.info())] : [],
      want('mcp') ? [mcpRow(mcp)] : [],
    ]);
    return groups.flat().filter((r) => !id || r.id === id || (id === 'shells' && r.id.startsWith('shell:')));
  });

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
    openTabs(current());
  });
  handle('tabs:openExternal', (url) => {
    const u = String(url);
    if (/^https?:/i.test(u)) return shell.openExternal(u);
  });

  handle('term:create', (opts) => {
    const t = terminals.create({ ...opts, ws: spaces.active });
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
    snapshot();
    persistSpaces();
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

  /** @type {import('@ghostery/adblocker-electron').ElectronBlocker | null} */
  let blocker = null;
  const window = win;
  /** @returns {Electron.MenuItemConstructorOptions} */
  const adBlockItem = () => ({
    label: blocker ? 'Block ads and trackers' : 'Block ads and trackers (loading lists…)',
    type: 'checkbox',
    checked: store.layout().adBlock,
    enabled: blocker !== null,
    click: (/** @type {Electron.MenuItem} */ mi) => {
      store.saveLayout({ adBlock: mi.checked });
      if (mi.checked) blocker?.enableBlockingInSession(browseSession);
      else blocker?.disableBlockingInSession(browseSession);
    },
  });
  // A tick later: during 'extension-unloaded' the extension is still in the list.
  const rebuild = () => setImmediate(() => buildMenu([adBlockItem(), { type: 'separator' }, ...extensionsMenu(browseSession, tabs, window)]));
  rebuild();
  // Installs from the Web Store and removals change the list.
  browseSession.extensions.on('extension-loaded', rebuild);
  browseSession.extensions.on('extension-unloaded', rebuild);
  // In the background: a first run downloads the lists, and browsing shouldn't wait for that.
  loadBlocker().then((b) => {
    blocker = b;
    if (store.layout().adBlock) b.enableBlockingInSession(browseSession);
    rebuild();
  }, (err) => console.error('[adblock] filter lists failed to load; browsing without blocking:', err));

  if (process.env.ACC_SMOKE_DIR) smoke(process.env.ACC_SMOKE_DIR, shellView.webContents, tabs, terminals, browseSession);
  await mcpReady;
  await shellView.webContents.loadURL('acc://shell/index.html');
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
  // process.exitCode: the smoke run's verdict; 0 otherwise.
  setImmediate(() => app.exit(Number(process.exitCode ?? 0)));
});
