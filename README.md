<a id="readme-top"></a>

<h1 align="center">🧭 AI Command Center</h1>

<p align="center">
  <em>One window for Mike's browser, PowerShell, project files and bookmarks,<br>with an MCP server that lets an agent drive it.</em>
</p>

<p align="center">
  <a href="docs/README.md"><strong>Explore the docs »</strong></a>
</p>

<p align="center">
  <a href="https://github.com/ai-automation-tools/ai-command-center">GitHub (private, incubating)</a>
  ·
  <a href="docs/ROADMAP.md">Roadmap</a>
  ·
  <a href="docs/CHANGELOG.md">Changelog</a>
  ·
  <a href="docs/decisions/README.md">Decisions</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-Phase_1_·_MVP-F59E0B?style=for-the-badge" alt="Status: Phase 1 MVP">
  <img src="https://img.shields.io/badge/runs_on-Windows_11-0078D4?style=for-the-badge" alt="Runs on Windows 11">
  <a href="docs/ROADMAP.md"><img src="https://img.shields.io/badge/plan-ROADMAP-8B5CF6?style=for-the-badge" alt="Roadmap"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-2ea44f?style=for-the-badge" alt="License: GPL-3.0-or-later"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-44.4-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 44.4">
  <img src="https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 24">
  <img src="https://img.shields.io/badge/xterm.js-6.0-000000?style=flat-square" alt="xterm.js 6.0">
  <img src="https://img.shields.io/badge/node--pty-1.1-6B7280?style=flat-square" alt="node-pty 1.1">
  <img src="https://img.shields.io/badge/PowerShell-7-5391FE?style=flat-square&logo=powershell&logoColor=white" alt="PowerShell 7">
</p>

---

A desktop app that puts a browser, PowerShell terminals and a sidebar over every workspace in one Electron window. The sidebar comes from [Project Hub](https://github.com/ai-automation-tools/project-hub), which already scans the workspaces and reads the browser bookmarks, so this app reuses it rather than rescanning disk. Phase 2 adds an MCP server and a chat panel so an agent can drive the whole window.

> [!WARNING]
> **LastPass and Rakuten don't work yet.** Both install from the Chrome Web Store and show their toolbar icons, but their background service workers crash in Electron 44. Until that's fixed upstream, the ↗ button opens the current page in your default browser. Details in [ADR-001](docs/decisions/adr-001-electron-shell.md#spike-result-2026-09-29).

> [!NOTE]
> A business analysis kept outside this repo recommended not building this and composing existing tools instead. Mike decided to build it on 2026-09-29; that override is recorded in the analysis's decisions folder.

## ✨ What works today

| Area | What you get |
|:---|:---|
| **🌐 Browser** | Tabs, address bar (URLs, `D:\` paths, `localhost`, or a search), back/forward/reload, links and pop-ups open as tabs, context menu, open in default browser. Chrome Web Store installs work in a tab. |
| **💻 Terminal** | PowerShell 7 in tabs along the bottom; the ⌄ next to ＋ opens Windows PowerShell, Command Prompt or Git Bash instead. "Terminal here" on any sidebar folder opens one there. Ctrl+C copies a selection, Ctrl+V pastes. |
| **📁 Files** | Every workspace from Project Hub. Click a file to read it in a tab under the app's own sidebar: Markdown rendered by Hub, other text as code, images inline, folders as a listing; clicking through files reuses that tab, Ctrl+click opens another. An HTML file opens as the page itself. Hover or right-click for Terminal here, View here, VS Code, Reveal in Explorer, Copy path and Copy Hub id. |
| **🔖 Bookmarks** | Your Chrome, Edge or Brave bookmarks (Hub reads them from disk), or Hub's own favorites. |
| **🕘 Recent and 🔍 Search** | Pages, files and terminals you've opened, and one search box across files, bookmarks and recent. |
| **🤖 MCP server** | A local MCP server for agents. Read-only tools: `list_tabs`, `sidebar_search` (the sidebar's search box) and `recent`. Navigation tools: `open_tab` (takes what the address bar takes) and `open_file` (a Hub node id from `sidebar_search`, opened in VS Code or revealed in Explorer). `terminal_run` shows a command over the terminal and types it in only when you click Run. Its address and per-launch token are in `%APPDATA%\ai-command-center\mcp.json`. Every call, including refused ones, shows in the sidebar's **MCP** tab and is appended to `%APPDATA%\ai-command-center\logs\mcp.log`. |
| **💬 Chat** | A **Chat** tab in the sidebar: Claude with the app's MCP server as its tools, so a message can open a tab, find or open a file, or put a command on the terminal's Run bar. The key and model come from your environment (see [Chat in the app](#-chat-in-the-app)); its tool calls show in the MCP tab like any other client's. |
| **⏱️ Cron** | A **Cron** tab in the sidebar listing [Cronsole](https://github.com/ai-automation-tools/cronsole)'s scheduled tasks, read through Cronsole's own MCP server: next run, paused, missing or failed at a glance, details on hover. **Open Cronsole**, or a click on a task, shows Cronsole's UI in a pinned tab at the left of the strip. Setup is under "Cronsole in the sidebar" below. |

## 🚀 Quick start

```powershell
# 1. Project Hub should be running (it usually is; the watchdog task restarts it)
Invoke-RestMethod http://127.0.0.1:4273/api/health

# 2. Install. node-pty ships prebuilt binaries, so no compiler is needed
npm install

# 3. Run the app (or .\scripts\Start-AICommandCenter.ps1, which leaves no console behind)
npm start

# 4. Check it: lint and unit tests, then a scripted launch that saves screenshots to .smoke/
npm run lint; npm test; npm run smoke
```

To start it from a shortcut or the Start menu without a terminal, point the shortcut at:

```text
pwsh -NoProfile -WindowStyle Hidden -File <repo>\scripts\Start-AICommandCenter.ps1
```

`npm install` on npm 11 asks before running install scripts; `node-pty` is already approved in `package.json`. If Electron's binary didn't download, run `node node_modules/electron/install.js`.

## 🤖 Drive the app from Claude Code

Every terminal the app opens has `ACC_MCP_URL` and `ACC_MCP_TOKEN` set to this launch's MCP address and token. Register the server once, using the variable names rather than their values, so it keeps working when a restart picks a new port and token:

```powershell
claude mcp add --scope user --transport http ai-command-center '${ACC_MCP_URL}' --header 'Authorization: Bearer ${ACC_MCP_TOKEN}'
```

The single quotes matter: they stop PowerShell expanding the variables, so Claude Code stores the names and fills them in each time it starts. Then run `claude` in one of the app's terminals and ask it to, say, "open this repo's README in a tab" or "run npm test". `/mcp` shows the connection, and commands sent through `terminal_run` still wait for you to click Run.

`--scope user` makes the server available in every folder. Claude Code started outside the app has no variables, so it lists `ai-command-center` as failed with a "Missing environment variables" warning, which is harmless. To use the app from another terminal while it runs, set the variables from `mcp.json` first:

```powershell
$m = Get-Content "$env:APPDATA\ai-command-center\mcp.json" | ConvertFrom-Json
$env:ACC_MCP_URL = $m.url; $env:ACC_MCP_TOKEN = $m.token
```

Every call shows in the sidebar's **MCP** tab. Each time Claude Code connects you'll also see two ✗ rows there: `server/discover`, a method this server doesn't offer, and a `405` for the event stream it doesn't serve. Both are expected.

## 💬 Chat in the app

The sidebar's **Chat** tab talks to Claude through the Anthropic API with your own key, and gives it the same MCP tools Claude Code gets. Set the key and the model as user environment variables, then restart the app:

```powershell
setx ACC_CHAT_API_KEY "<your Anthropic API key>"
setx ACC_CHAT_MODEL "<a Claude model ID>"
```

`ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` work too, but `ACC_CHAT_API_KEY` keeps the key out of Claude Code's way: with `ANTHROPIC_API_KEY` set, `claude` in a terminal bills that key instead of your subscription. There is no default model, so the app never picks what you pay for. The key stays in the main process; the panel only ever sees the model name.

Enter sends, Shift+Enter starts a new line, Clear starts a new conversation. Each tool call shows in the conversation as it happens, and `terminal_run` still waits for your click on the terminal's Run bar; a denial goes back to Claude as an error.

## ⏱️ Cronsole in the sidebar

The **Cron** tab starts Cronsole's MCP server the first time you open it and calls its `list_tasks` tool. Point the app at the server's entry script in a Cronsole checkout, then restart the app:

```powershell
setx ACC_CRONSOLE_MCP "<cronsole>\mcp-server\dist\index.js"
```

The server runs on the app's own Electron binary in Node mode and gets the app's environment, so it finds `CRONSOLE_TOKEN` and `CRONSOLE_API_URL` the same way it does under Claude Code; Cronsole's backend has to be running. Cronsole's UI opens from `http://localhost:7373`; set `ACC_CRONSOLE_UI` if yours is elsewhere. A tab on that address is the pinned tab: it sits first in the strip with no close button (Ctrl+W still closes it), and **Open Cronsole** goes back to it instead of opening another. Refresh asks Cronsole again; the server stops when the app quits.

## 🌿 Branches

Work on `mike_desktop`, push it, and open a pull request against `main`:

```powershell
git push origin mike_desktop
gh pr create --base main --head mike_desktop
```

A weekly roadmap routine also opens PRs, from `roadmap/auto-<date>` branches, one release gate at a time (see [the roadmap](docs/ROADMAP.md)). Dependency changes are never made by the routine, so after one merges, quit the app and run `npm install` yourself.

## ⌨️ Shortcuts

| Keys | Does |
|:---|:---|
| Ctrl+T / Ctrl+W | New tab / close tab |
| Alt+D, or Ctrl+L in a page | Address bar |
| F5, or Ctrl+R in a page | Reload |
| Ctrl+\` / Ctrl+Shift+\` | Toggle terminal / new terminal |
| Ctrl+Shift+F | Search everything |
| Ctrl+B | Toggle sidebar |
| F12 / Ctrl+Shift+I | Page devtools / shell devtools |

Ctrl+L and Ctrl+R stay with PowerShell when the terminal has focus.

## 🗂️ What's in here

| Folder | What's inside |
|:---|:---|
| [**🧩 src/**](src/README.md) | The app: main process, the shell's preload, the shell UI, and shared helpers. |
| [**🧪 tests/**](tests/README.md) | 74 unit tests, plus how the smoke run and the extension spike check the real app. |
| [**📚 docs/**](docs/README.md) | Roadmap (the release gates), changelog, product spec and build plan, requirements, architecture options, and three ADRs. |
| [**🤖 CLAUDE.md**](CLAUDE.md) | Standards, verification commands and the Won't list for any agent working here, including the weekly roadmap routine. |
| [**📜 scripts/**](scripts/smoke.js) | `smoke.js` behind `npm run smoke` and `npm run spike:extensions`; `lint.js` behind `npm run lint`; `Start-AICommandCenter.ps1`, which starts the app with no console window and writes Electron's output to `%APPDATA%\ai-command-center\logs\launch.*.log`. |

## 🔒 Security model

- Browser tabs are sandboxed, get no preload from this app, and can't navigate to `javascript:`, `data:` or custom protocol URLs.
- Every IPC channel checks that the sender is the shell UI.
- Document pages (`acc://doc/…`) are served to the sandboxed tabs only, run no scripts (a `default-src 'none'` policy), can't be framed, and can't be reached from a web page. Only files in Project Hub's index are served, so a crafted address can't read anything else.
- Each terminal shell is a fixed executable with fixed arguments; the UI can only choose a starting folder and a shell by name. An agent's `terminal_run` never starts a process: it types one line into a running PowerShell after you click Run, the main process keeps the command (the click only picks the terminal), and newlines, control and invisible characters are refused so the bar shows exactly what runs. Unanswered asks expire after 5 minutes.
- The only listening port is the app's MCP server: `127.0.0.1` only, a random port and a fresh token each launch (in `%APPDATA%\ai-command-center\mcp.json`, deleted on quit), and every call without the token is refused. Every call, answered or refused, is logged to the sidebar's MCP tab and `%APPDATA%\ai-command-center\logs\mcp.log` (one JSON line each, arguments clipped to 300 characters, rotated at 5 MB). Its `open_file` tool passes Hub node ids, never paths, and can't open a file with its default app, so an agent can't launch a script that way. Project Hub is reached over loopback from the main process.
- Cronsole's MCP server is the only process the app starts besides the terminals: this app's own Electron binary running the script named by `ACC_CRONSOLE_MCP`, which only the user's environment can set. It talks over stdin and stdout and listens on nothing, and the app calls only its read-only `list_tasks`.
- The chat panel's API key is read from the environment by the main process and goes only to `api.anthropic.com`; it's never sent to the shell UI or written to disk. The chat's tool calls go through the MCP server with its token, so they're logged and confirmed like any other agent's, and Claude's replies are shown as plain text, never HTML.

## ⚖️ Licence

GPL-3.0-or-later. See [LICENSE](LICENSE).

The browser's Chrome extension support comes from [electron-chrome-extensions](https://github.com/samuelmaddock/electron-browser-shell), which is available under GPL-3.0 or a paid licence. This project uses the GPL terms, so the app is GPL too: you can use, change and share it, and anything you distribute that's built from it has to ship its source under the same licence. The reasoning is in [ADR-001](docs/decisions/adr-001-electron-shell.md#consequences).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<p align="center">
  Incubating in <a href="https://github.com/ai-automation-tools">ai-automation-tools</a>, private until its release gates are done · Built on <a href="https://www.electronjs.org">Electron</a>, <a href="https://xtermjs.org">xterm.js</a>, <a href="https://github.com/samuelmaddock/electron-browser-shell">electron-chrome-extensions</a> · <a href="LICENSE">GPL-3.0-or-later</a> · <a href="docs/README.md">Docs</a>
</p>
