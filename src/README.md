<h1 align="center">🧩 Source</h1>

<p align="center">
  <em>The app: main process, one preload, the shell UI, and helpers both sides share.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript ES modules">
  <img src="https://img.shields.io/badge/build_step-none-2ea44f?style=for-the-badge" alt="No build step">
  <a href="../README.md"><img src="https://img.shields.io/badge/↩-repository_root-6B7280?style=for-the-badge" alt="Repository root"></a>
</p>

---

Plain JavaScript with JSDoc types, no bundler. Electron loads `main/main.js` directly; the shell UI loads from this folder over the private `acc://shell/` protocol, which serves `renderer/`, `shared/`, and the two xterm packages from `node_modules`, and nothing else.

## 🖥️ main/ — the main process

| File | What it does |
|:---|:---|
| [**main.js**](main/main.js) | Creates the window and the shell view, serves `acc://shell/`, registers every IPC channel (each refuses any sender but the shell), builds the menu of shortcuts, and runs `npm run smoke` when `ACC_SMOKE_DIR` is set. |
| [**tabs.js**](main/tabs.js) | Browser tabs: one sandboxed `WebContentsView` each, sized to the rectangle the shell reports. Blocks `javascript:` and other schemes, turns pop-ups into tabs, owns the page context menu. |
| [**extensions.js**](main/extensions.js) | electron-chrome-extensions and the Web Store installer on the browse session. See [ADR-001](../docs/decisions/adr-001-electron-shell.md). |
| [**terminal.js**](main/terminal.js) | PowerShell sessions through node-pty. The renderer picks a folder; the executable and arguments are fixed here. See [ADR-003](../docs/decisions/adr-003-terminal-in-main.md). |
| [**hub.js**](main/hub.js) | The Project Hub client: health, scan, bookmarks, favorites, open. See [ADR-002](../docs/decisions/adr-002-hub-over-http.md). |
| [**store.js**](main/store.js) | `recent.json` and `layout.json` in `%APPDATA%\ai-command-center`, written atomically. |

## 🔌 preload/

| File | What it does |
|:---|:---|
| [**shell.cjs**](preload/shell.cjs) | Exposes `window.acc` to the shell UI only, and registers `<browser-action-list>` for extension toolbar icons. Browser tabs get no preload from this app. |

## 🎨 renderer/ — the shell UI

| File | What it does |
|:---|:---|
| [**index.html**](renderer/index.html) | The layout: sidebar, splitters, tab strip, address bar, content area, terminal panel. Strict CSP. |
| [**app.js**](renderer/app.js) | Wires everything together: tab strip and address bar, splitter drags, shortcuts, and reporting the content rectangle so the active tab sits exactly over it. |
| [**sidebar.js**](renderer/sidebar.js) | Files, Bookmarks and Recent panels and the search box across them. |
| [**terminal.js**](renderer/terminal.js) | One xterm.js instance per PowerShell session, with copy and paste keys. |
| [**styles.css**](renderer/styles.css) | Dark theme and the grid layout. |

## 🔁 shared/ — pure helpers, unit-tested

| File | What it does |
|:---|:---|
| [**tree.js**](shared/tree.js) | Hub node ids to paths, what a click on a node does, flattening a 35k-node tree without recursion, and ranked search. |
| [**url.js**](shared/url.js) | Address-bar text to a URL (paths, loopback, hosts, search) and the allowed navigation schemes. |
| [**recent.js**](shared/recent.js) | Adding to and cleaning the Recent list. |

---

<p align="center">
  <a href="../README.md">← Repository home</a> ·
  <a href="../tests/README.md">Tests →</a>
</p>
