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

Plain JavaScript with JSDoc types, no bundler. Electron loads `main/main.js` directly; the shell UI loads from this folder over the private `acc://shell/` protocol, which serves `renderer/`, `shared/`, and the two xterm packages from `node_modules`, and nothing else. Every path in the shell UI is relative, so the same files also serve from a subpath on GitHub Pages as the demo (`demo/`, below).

## 🖥️ main/ — the main process

| File | What it does |
|:---|:---|
| [**main.js**](main/main.js) | Creates the window and the shell view, serves `acc://shell/`, denies pages every permission not in `shared/permissions.js`, hooks the crash log, registers every IPC channel (each refuses any sender but the shell), builds the menu of shortcuts (tab cycling and picking, reopen, zoom, find), holds `terminal_run`'s and `cron_run`'s pending confirmations, registers the Cron tab's `cronsole:` channels, saves the open tabs on close and restores them when the shell asks, starts the MCP server once the tabs exist and hands its tools the tabs, Hub and the Recent list (open-in-Hub is one function shared by the sidebar and `open_file`), holds `terminal_run`'s pending confirmations and types the command once the shell answers, registers the chat panel's `chat:` channels, pops up native context menus for the shell (`menu:popup`), builds the menu of shortcuts, and runs `npm run smoke` when `ACC_SMOKE_DIR` is set. |
| [**tabs.js**](main/tabs.js) | Browser tabs: one sandboxed `WebContentsView` each, sized to the rectangle the shell reports. Blocks `javascript:` and other schemes, turns pop-ups into tabs, owns the page context menu, keeps the last 10 closed URLs for Reopen closed tab, zooms, finds in the page and reports the match count, and reads a page's visible text for `read_tab`. |
| [**extensions.js**](main/extensions.js) | electron-chrome-extensions and the Web Store installer on the browse session, and the app menu's Extensions submenu (Web Store, options, remove). See [ADR-001](../docs/decisions/adr-001-electron-shell.md). |
| [**terminal.js**](main/terminal.js) | Shell sessions through node-pty. The renderer picks a folder and a profile from `shared/shells.js`, where executables and arguments are fixed. Tracks which sessions are PowerShell, the only ones `terminal_run` types into, keeps the newest 200,000 characters of each session's output for `terminal_read`, and which session the panel shows. See [ADR-003](../docs/decisions/adr-003-terminal-in-main.md). Every session gets `ACC_MCP_URL` and `ACC_MCP_TOKEN` once the MCP server is up, so `claude` in it can reach the app. |
| [**docs.js**](main/docs.js) | Serves `acc://doc/<Hub id>` on the browse session: Hub's `/api/file` HTML wrapped in a script-free page, folder listings, and images read from disk for document pages only. Only ids in Hub's index. Hands `acc://run/…` to `cronsole.js`, refusing any request with a referrer but another run page. The index is invalidated on Hub's `change` events. |
| [**hub.js**](main/hub.js) | The Project Hub client: health, scan, bookmarks, favorites (read and star-toggle through `PUT /api/favorites`), file, open, and the `/api/events` subscription that reloads the tree and drops the doc index when Hub rescans. See [ADR-002](../docs/decisions/adr-002-hub-over-http.md). |
| [**chat.js**](main/chat.js) | The chat panel's one conversation: reads the key and model from the environment at each send, checks which attachments the panel asked for, gets the tools from the MCP server, runs the turn from `shared/chat.js`, and sends each step to the shell, streamed text included. Loads the last conversation from `chat.json` at start, hands the panel its transcript, and saves after every turn and on Clear. The key never leaves the main process. |
| [**mcp.js**](main/mcp.js) | Starts the Control Center MCP server, with the tools from `shared/tools.js`, on `127.0.0.1` with a random port and a per-launch token, writes both to `mcp.json` in `%APPDATA%\ai-command-center`, and removes the file on quit. It hands back the URL and token for the terminals. `mcpLog()` keeps the newest 200 calls for the sidebar and appends every call to `logs\mcp.log` through `applog.js`. |
| [**applog.js**](main/applog.js) | Append-only log files under `logs\`, rotated at 5 MB, and the crash log: uncaught errors and rejections in the main process, and renderer, tab or helper processes going away, written to `app.log`. |
| [**cronsole.js**](main/cronsole.js) | Cronsole's MCP server as a child process: this app's Electron binary in Node mode running the script `ACC_CRONSOLE_MCP` names, started on first use, started again after it exits, killed on quit. Answers the sidebar and `cron_tasks` with `list_tasks`, a task's runs with `get_task_history`, an `acc://run` page with the run's log or `get_run_output` (a task in the list and a run in its history only), and `cron_run` with `run_task` once the user has clicked. |
| [**store.js**](main/store.js) | `recent.json`, `layout.json` (splitter sizes, terminal state, bookmark source, and the tabs open at the last close), `chat.json` (the chat's last conversation, read through `shared/chat.js`'s `cleanMessages`) and `settings.json` (read through `shared/settings.js`) in `%APPDATA%\ai-command-center`, written atomically. |

## 🔌 preload/

| File | What it does |
|:---|:---|
| [**shell.cjs**](preload/shell.cjs) | Exposes `window.acc` to the shell UI only, and registers `<browser-action-list>` for extension toolbar icons. Browser tabs get no preload from this app but the extension-API ones, which act only on `chrome-extension://` pages. |
| [**extension-browser.cjs**](preload/extension-browser.cjs) | In extension pages and service workers only, points `browser` at the `chrome` object electron-chrome-extensions fills in, so MV3 extensions that prefer `browser` find `windows`, `cookies` and the rest. See [ADR-001](../docs/decisions/adr-001-electron-shell.md#update-2026-10-20-the-browser-namespace). |

## 🎨 renderer/ — the shell UI

| File | What it does |
|:---|:---|
| [**index.html**](renderer/index.html) | The layout: sidebar, splitters, tab strip, address bar with the find bar, content area, terminal panel. Strict CSP. |
| [**app.js**](renderer/app.js) | Wires everything together: tab strip and address bar, the address-bar ☆ that adds the page to Hub's favorites, splitter drags, shortcuts, the confirm bar for `terminal_run` and `cron_run` (one ask at a time; Deny has focus), the find bar (Ctrl+F, match count, Enter and Shift+Enter, closes on tab change), the shell menu on the terminal strip, opening documents in a tab (reusing one already showing a document; Ctrl+click for another), the pinned Cronsole tab (first in the strip, no close button, reused by Open Cronsole), and reporting the content rectangle so the active tab sits exactly over it. |
| [**chat.js**](renderer/chat.js) | The sidebar's Chat tab: shows the conversation as plain text (messages, each tool call and its result), grows Claude's reply as the text streams in, replays the saved conversation on start, sends what you type with the + page and + terminal toggles that are on, and says which variables to set when the key or model is missing. |
| [**sidebar.js**](renderer/sidebar.js) | Files, Bookmarks and Recent panels and the search box across them, plus the MCP panel of calls agents made and the Cron panel of Cronsole's tasks, where a click unfolds a task's last runs and a run opens its output page. Clicks, hover buttons and the right-click menu on Files rows all go through one `fileAction()`. The Files tree reloads when Hub reports a change. |
| [**terminal.js**](renderer/terminal.js) | One xterm.js instance per shell session, with copy and paste keys and a link provider that opens web addresses in the output as tabs; tells main which session is showing, so `terminal_read` reads that one by default. |
| [**styles.css**](renderer/styles.css) | Dark theme and the grid layout. |

## 🎭 demo/ — the browser demo

The shell UI from `renderer/` running in an ordinary browser. `npm run demo` (`scripts/demo.js`) copies `renderer/`, `shared/`, this folder and xterm into `_site/`. Not deployed yet: it goes to Pages when the repo goes public. The app never loads anything here.

| File | What it does |
|:---|:---|
| [**acc.js**](demo/acc.js) | `demoApi()`: every call `preload/shell.cjs` exposes, answered from made-up files, bookmarks, Cronsole tasks and MCP calls. Tabs keep a history but have no browser behind them; terminals echo what you type and answer `npm test`, `git status`, `ls` and `help` with canned output; one `terminal_run` ask shows the confirm bar after six seconds; the chat streams one canned reply. No network, no storage. |
| [**install.js**](demo/install.js) | Loaded before `app.js`: puts `demoApi()` on `window.acc`, draws the stand-in page where a tab would be, and shows toasts. |
| [**page.js**](demo/page.js) | `demoHtml()`: the app's `index.html` with the org source bar at the top, the demo stylesheet and `install.js` added; fails if `index.html` moved an anchor it relies on. |
| [**demo.css**](demo/demo.css) | The fixed source bar (the shell is shortened by its height), the stand-in page and toasts. |

## 🔁 shared/ — pure helpers, unit-tested

| File | What it does |
|:---|:---|
| [**tree.js**](shared/tree.js) | Hub node ids to paths, what a click on a node does, the right-click menu items, flattening a 35k-node tree without recursion, ranked search, and `searchAll`, the one search across files, bookmarks and recent that the sidebar and `sidebar_search` share. |
| [**url.js**](shared/url.js) | Address-bar text to a URL (paths, loopback, hosts, search) and the allowed navigation schemes, with `acc://doc` allowed only from the app or another document, and `acc://run` from the app only. |
| [**recent.js**](shared/recent.js) | Adding to and cleaning the Recent list. |
| [**mcp.js**](shared/mcp.js) | The MCP server itself: JSON-RPC over Streamable HTTP with plain JSON replies, bearer-token and loopback-Host checks, `initialize`, `ping`, `tools/list` (with each tool's `annotations`) and `tools/call`. No Electron, so the tests run it for real. Reports every request, refused ones too, through an `onCall` hook. |
| [**chat.js**](shared/chat.js) | The chat's turn loop: the key and model from the environment (no default model), MCP tools in the Messages API's format, a JSON-RPC client for the app's MCP server, the API call with streaming on and the server-sent events put back into a reply (`readStream`), trimming whole turns from the front past a 50,000-token estimate (`trimHistory`), checking a saved `chat.json` (`cleanMessages`) and turning it back into what the panel shows (`transcript`), the + page and + terminal attachments (read through `read_tab` and `terminal_read`, wrapped in `<attached …>` blocks above the text), and one turn of post, run the tools Claude asks for, post the results, at most 10 rounds. |
| [**mcplog.js**](shared/mcplog.js) | The MCP call log's entries: method, tool, clipped arguments, success, time, error or refusal status; the JSON line written to `mcp.log`; and the capped newest-first list. |
| [**tools.js**](shared/tools.js) | The MCP tools: read-only `list_tabs`, `read_tab` (a tab's visible text, clipped), `sidebar_search`, `recent`, `list_terminals` and `terminal_read` (the last lines of a session, cleaned by `output.js`); navigation `open_tab` (address-bar text, http, https and file only) and `open_file` (Hub node ids only, VS Code or reveal, never default-app); `terminal_run` (one line, no control or invisible characters, run only after a click); `cron_tasks` and `cron_run` (a Cronsole task id, run only after a click). Each carries MCP `annotations` (read-only, destructive, open-world hints). The main process passes in the data sources and actions. |
| [**output.js**](shared/output.js) | Terminal output for an agent: a one-line cell model that resolves ConPTY's cursor moves and erases into what the screen shows, drops the other escapes and control characters, the last N lines, and the capped buffer the main process keeps per session. |
| [**settings.js**](shared/settings.js) | `settings.json` with neutral defaults: the Project Hub URL (`ACC_HUB_URL` wins) and the empty-tab quick links, http(s) only. |
| [**permissions.js**](shared/permissions.js) | The three permissions a page may be granted (fullscreen, pointer lock, sanitized clipboard writes); everything else is refused. |
| [**confirm.js**](shared/confirm.js) | Pending questions to the user: each ask gets an id, settles once with the answer, or with null after a timeout, when the UI is told to drop it. |
| [**shells.js**](shared/shells.js) | The shell profiles (PowerShell 7, Windows PowerShell, Command Prompt, Git Bash): fixed executables and arguments, only those installed, picked by id. |
| [**docs.js**](shared/docs.js) | Document pages: `acc://doc` URLs that mirror Hub ids (so relative links resolve), the page wrapper and its headers, folder listings, image types, and the page around a Cronsole run's output. |
| [**events.js**](shared/events.js) | Project Hub's `/api/events` server-sent stream, parsed from bytes: `change` events and their data, the `retry` preamble and heartbeats ignored, events and multi-line data split across chunks handled. |
| [**favorites.js**](shared/favorites.js) | Starring the current page: whether a URL is already in Hub's favorites tree, and adding it to (or removing it from) the Favorites bar, non-web URLs ignored. |
| [**links.js**](shared/links.js) | Web addresses in a line of terminal output for the terminal's link provider: `http(s)://` URLs and bare `localhost`, `127.0.0.1` or `[::1]` with a port, trailing punctuation dropped, brackets the link opened kept. |
| [**menu.js**](shared/menu.js) | Checks the item list the shell sends for a native context menu. |
| [**cronsole.js**](shared/cronsole.js) | Cronsole: the server path and UI origin from the environment, which tab URLs are the pinned Cronsole tab, a JSON-RPC client over stdio (newline-delimited, partial lines buffered, timeouts), the MCP handshake, `list_tasks` with its result cleaned into rows, `run_task` with its id checked, `get_task_history` and `get_run_output`, `acc://run` URLs, and how a task or run row reads in the sidebar. |
| [**session.js**](shared/session.js) | Cleaning the saved tab list in `layout.json`, picking which restored tab to activate, and the next, previous or numbered tab for the keyboard shortcuts. |

---

<p align="center">
  <a href="../README.md">← Repository home</a> ·
  <a href="../tests/README.md">Tests →</a>
</p>
