<a id="readme-top"></a>

<h1 align="center">🧭 AI Command Center</h1>

<p align="center">
  <em>One window for your browser, PowerShell, project files and bookmarks,<br>with an MCP server that lets an agent drive it.</em>
</p>

<p align="center">
  <a href="docs/README.md"><strong>Explore the docs »</strong></a>
  ·
  <a href="https://ai-command-center.ai-automation-tools.dev/"><strong>Try the demo »</strong></a>
</p>

<p align="center">
  <a href="https://github.com/ai-automation-tools/ai-command-center">GitHub</a>
  ·
  <a href="docs/ROADMAP.md">Roadmap</a>
  ·
  <a href="docs/CHANGELOG.md">Changelog</a>
  ·
  <a href="docs/decisions/README.md">Decisions</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-public_since_2026--10--18-2ea44f?style=for-the-badge" alt="Status: public since 2026-10-18">
  <img src="https://img.shields.io/badge/runs_on-Windows_11-0078D4?style=for-the-badge" alt="Runs on Windows 11">
  <a href="docs/ROADMAP.md"><img src="https://img.shields.io/badge/plan-ROADMAP-8B5CF6?style=for-the-badge" alt="Roadmap"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-2ea44f?style=for-the-badge" alt="License: GPL-3.0-or-later"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-44.7-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 44.7">
  <img src="https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 24">
  <img src="https://img.shields.io/badge/xterm.js-6.0-000000?style=flat-square" alt="xterm.js 6.0">
  <img src="https://img.shields.io/badge/node--pty-1.1-6B7280?style=flat-square" alt="node-pty 1.1">
  <img src="https://img.shields.io/badge/PowerShell-7-5391FE?style=flat-square&logo=powershell&logoColor=white" alt="PowerShell 7">
</p>

---

A Windows desktop app that puts a browser, PowerShell terminals and a sidebar over every project folder you work in into one Electron window. The sidebar comes from [Project Hub](https://github.com/ai-automation-tools/project-hub), a small local server that already scans your workspaces and reads your browser bookmarks, so this app reuses it rather than rescanning disk. An MCP server and a chat panel let an agent, Claude Code in one of the app's terminals or Claude in the sidebar, drive the whole window: open tabs and files, read what a page or a terminal shows, and run commands you approve with a click.

> [!WARNING]
> **Extensions with Manifest V3 background workers don't work yet.** LastPass and Rakuten, for instance, install from the Chrome Web Store and show their toolbar icons, but their service workers crash in Electron 44. Until that's fixed upstream, the ↗ button opens the current page in your default browser. Details in [ADR-001](docs/decisions/adr-001-electron-shell.md#spike-result-2026-09-29).

> [!TIP]
> **[Try the demo](https://ai-command-center.ai-automation-tools.dev/)** in any browser: the real shell UI with made-up files, bookmarks, tabs and terminal output. Nothing in it runs or calls out; type `npm test` in its terminal, or wait a few seconds for the confirm bar an agent's `terminal_run` raises.

> [!NOTE]
> This is a personal tool being readied for a public release; the [roadmap](docs/ROADMAP.md) lists what's left before that. It runs on Windows 11 only.

## ✨ What works today

| Area | What you get |
|:---|:---|
| **🌐 Browser** | Tabs, address bar (URLs, `D:\` paths, `localhost`, or a search), back/forward/reload, links and pop-ups open as tabs, context menu, open in default browser. A ☆ in the address bar adds the page to Hub's favorites (again to remove). Chrome Web Store installs work in a tab. |
| **💻 Terminal** | PowerShell 7 in tabs along the bottom; the ⌄ next to ＋ opens Windows PowerShell, Command Prompt or Git Bash instead. "Terminal here" on any sidebar folder opens one there. Ctrl+C copies a selection, Ctrl+V pastes. |
| **📁 Files** | Every workspace from Project Hub; a rescan by Hub shows up on its own. Click a file to read it in a tab under the app's own sidebar: Markdown rendered by Hub, other text as code, images inline, folders as a listing; clicking through files reuses that tab, Ctrl+click opens another. An HTML file opens as the page itself. Hover or right-click for Terminal here, View here, VS Code, Reveal in Explorer, Copy path and Copy Hub id. |
| **🔖 Bookmarks** | Your Chrome, Edge or Brave bookmarks (Hub reads them from disk), or Hub's own favorites. |
| **🕘 Recent and 🔍 Search** | Pages, files and terminals you've opened, and one search box across files, bookmarks and recent. |
| **🤖 MCP server** | A local MCP server for agents. Tools that look: `list_tabs`, `read_tab` (a tab's visible text), `sidebar_search` (the sidebar's search box), `recent`, `list_terminals` and `terminal_read` (the last lines a terminal printed, escapes stripped). Navigation tools: `open_tab` (takes what the address bar takes) and `open_file` (a Hub node id from `sidebar_search`, opened in VS Code or revealed in Explorer). `terminal_run` shows a command over the terminal and types it in only when you click Run; `terminal_read` afterwards shows the agent what happened. `cron_tasks` and `cron_run` do the same for Cronsole's scheduled tasks, with the same click. `tools/list` marks each tool read-only or not, and `terminal_run` and `cron_run` as destructive, so a client can show which tools look and which act. Its address and per-launch token are in `%APPDATA%\ai-command-center\mcp.json`. Every call, including refused ones, shows in the sidebar's **MCP** tab and is appended to `%APPDATA%\ai-command-center\logs\mcp.log`. |
| **💬 Chat** | A **Chat** tab in the sidebar: Claude with the app's MCP server as its tools, so a message can open a tab, find or open a file, or put a command on the terminal's Run bar. **+ page** and **+ terminal** attach what the active tab or the showing terminal says to your next message. Replies stream in as they're written, and the last conversation is back after a restart. The key and model come from your environment (see [Chat in the app](#-chat-in-the-app)); its tool calls show in the MCP tab like any other client's. |
| **⏱️ Cron** | A **Cron** tab in the sidebar listing [Cronsole](https://github.com/ai-automation-tools/cronsole)'s scheduled tasks, read through Cronsole's own MCP server: next run, paused, missing or failed at a glance, details on hover. **Open Cronsole**, or a click on a task, shows Cronsole's UI in a pinned tab at the left of the strip. An agent can list the tasks and, after you click Run, start one. Setup is under "Cronsole in the sidebar" below. |

## 🚀 Quick start

You need Windows 11, [Node.js](https://nodejs.org) 24, [PowerShell 7](https://github.com/PowerShell/PowerShell) and a running [Project Hub](https://github.com/ai-automation-tools/project-hub) (its README is a two-minute setup: point it at your project folders and start it; it listens on `http://127.0.0.1:4273`).

```powershell
# 1. Check Project Hub answers
Invoke-RestMethod http://127.0.0.1:4273/api/health

# 2. Install. node-pty ships prebuilt binaries, so no compiler is needed
git clone https://github.com/ai-automation-tools/ai-command-center
cd ai-command-center
npm install

# 3. Run the app (or .\scripts\Start-AICommandCenter.ps1, which leaves no console behind)
npm start

# 4. Check it: lint and unit tests, then a scripted launch that saves screenshots to .smoke/
npm run lint; npm test; npm run smoke
```

Without Project Hub the app still runs: the browser, terminals and extensions work, and the Files and Bookmarks panels say Hub isn't reachable and offer Retry. Everything the app saves (open tabs, splitter sizes, recent items, the last chat conversation, installed extensions, site data) lives under `%APPDATA%\ai-command-center`.

To start it from a shortcut or the Start menu without a terminal, point the shortcut at:

```text
pwsh -NoProfile -WindowStyle Hidden -File <repo>\scripts\Start-AICommandCenter.ps1
```

`npm install` on npm 11 asks before running install scripts; `node-pty` is already approved in `package.json`. If Electron's binary didn't download, run `node node_modules/electron/install.js`.

### Settings

Everything per-machine lives in `%APPDATA%\ai-command-center\settings.json`, which you only need if the defaults don't fit:

```json
{
  "hubUrl": "http://127.0.0.1:4273",
  "quickLinks": [
    { "label": "Project Hub", "url": "http://127.0.0.1:4273" },
    { "label": "Chrome Web Store", "url": "https://chromewebstore.google.com" }
  ]
}
```

`hubUrl` is where Project Hub answers (`ACC_HUB_URL` in the environment overrides it); `quickLinks` are the buttons on the empty tab page, http(s) only, twelve at most. Broken values fall back to these defaults. Logs sit next to it in `logs\`: `app.log` for crashes and errors in the app's own processes, `mcp.log` for every MCP call, and `launch.*.log` from the launcher script.

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

Enter sends, Shift+Enter starts a new line, Clear starts a new conversation. **+ page** and **+ terminal** attach the active tab's text or the showing terminal's last lines to your next message, read through `read_tab` and `terminal_read` the way Claude would, so "what does this page say" needs no tool round-trip; both switch off once the message is sent. Claude's reply streams in as it's written. The conversation is saved to `%APPDATA%\ai-command-center\chat.json` after every message, attached page and terminal text included, and comes back when the app restarts; Clear empties the file. Once a conversation passes about 50,000 tokens (estimated at four characters a token), the oldest whole turns are dropped before the next request, and the panel says how many went. Each tool call shows in the conversation as it happens, and `terminal_run` still waits for your click on the terminal's Run bar; a denial goes back to Claude as an error.

## ⏱️ Cronsole in the sidebar

The **Cron** tab starts Cronsole's MCP server the first time you open it and calls its `list_tasks` tool. Point the app at the server's entry script in a Cronsole checkout, then restart the app:

```powershell
setx ACC_CRONSOLE_MCP "<cronsole>\mcp-server\dist\index.js"
```

The server runs on the app's own Electron binary in Node mode and gets the app's environment, so it finds `CRONSOLE_TOKEN` and `CRONSOLE_API_URL` the same way it does under Claude Code; Cronsole's backend has to be running. Agents get the same list through the `cron_tasks` MCP tool, and `cron_run` starts a task by id once you click Run on the bar over the terminal, which shows the task's name. Cronsole's UI opens from `http://localhost:7373`; set `ACC_CRONSOLE_UI` if yours is elsewhere. A tab on that address is the pinned tab: it sits first in the strip with no close button (Ctrl+W still closes it), and **Open Cronsole** goes back to it instead of opening another. Refresh asks Cronsole again; the server stops when the app quits.

## 🌿 Contributing

Branch from `main`, keep `npm run lint` and `npm test` green (CI runs both on every push), run `npm run smoke` when you touch the main process or the shell UI, and open a pull request against `main`. [CLAUDE.md](CLAUDE.md) has the standards, the security invariants that every change has to keep, and the list of things this project won't do. A scheduled roadmap routine also opens PRs twice a week, from `roadmap/auto-<date>` branches, one roadmap item at a time (see [the roadmap](docs/ROADMAP.md)); an org-wide sweep reviews and merges them, and a daily stage promotes the repo to public once every release gate is ticked. Dependency changes are never made by the routine, so after one of its PRs merges, quit the app and run `npm install` yourself.

## ⌨️ Shortcuts

| Keys | Does |
|:---|:---|
| Ctrl+T / Ctrl+W / Ctrl+Shift+T | New tab / close tab / reopen the last closed tab |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous tab |
| Ctrl+1 … Ctrl+8, Ctrl+9 | That tab, the last tab |
| Alt+D, or Ctrl+L in a page | Address bar |
| Ctrl+F | Find in page (Enter / Shift+Enter step, Escape closes) |
| F5, or Ctrl+R in a page | Reload |
| Ctrl+plus / Ctrl+minus / Ctrl+0 | Zoom in / out / reset (remembered per site) |
| Ctrl+\` / Ctrl+Shift+\` | Toggle terminal / new terminal |
| Ctrl+Shift+F | Search everything |
| Ctrl+B | Toggle sidebar |
| F12 / Ctrl+Shift+I | Page devtools / shell devtools |

Ctrl+L and Ctrl+R stay with PowerShell when the terminal has focus.

## 🗂️ What's in here

| Folder | What's inside |
|:---|:---|
| [**🧩 src/**](src/README.md) | The app: main process, the shell's preload, the shell UI, and shared helpers; plus `demo/`, the fake `window.acc` the browser demo runs on. |
| [**🧪 tests/**](tests/README.md) | The unit tests over `src/shared/`, plus how the smoke run and the extension spike check the real app. |
| [**📚 docs/**](docs/README.md) | Roadmap (the release gates), changelog, product spec and build plan, requirements, architecture options, and three ADRs. |
| [**🤖 CLAUDE.md**](CLAUDE.md) | Standards, verification commands and the Won't list for any agent working here, including the weekly roadmap routine. |
| [**📜 scripts/**](scripts/smoke.js) | `smoke.js` behind `npm run smoke` and `npm run spike:extensions`; `lint.js` behind `npm run lint`; `demo.js` behind `npm run demo`, which builds the browser demo into `_site/`; `Start-AICommandCenter.ps1`, which starts the app with no console window and writes Electron's output to `%APPDATA%\ai-command-center\logs\launch.*.log`. |
| [**🛡️ SECURITY.md**](SECURITY.md) | How to report a vulnerability, the model in short, and the last secret scan. CI is `.github/workflows/ci.yml`. `.github/workflows/pages.yml` builds the demo with `npm run demo` and deploys it to Pages on every push to `main`. |

## 🔒 Security model

- Browser tabs are sandboxed, get no preload from this app, and can't navigate to `javascript:`, `data:` or custom protocol URLs. A page gets no permission it asks for (camera, microphone, location, notifications, MIDI, screen capture, clipboard reads, USB, serial, HID) except fullscreen, pointer lock and sanitized clipboard writes; Electron would grant all of them without a handler.
- Every IPC channel checks that the sender is the shell UI.
- Document pages (`acc://doc/…`) are served to the sandboxed tabs only, run no scripts (a `default-src 'none'` policy), can't be framed, and can't be reached from a web page. Only files in Project Hub's index are served, so a crafted address can't read anything else.
- Each terminal shell is a fixed executable with fixed arguments; the UI can only choose a starting folder and a shell by name. An agent's `terminal_run` never starts a process: it types one line into a running PowerShell after you click Run, the main process keeps the command (the click only picks the terminal), and newlines, control and invisible characters are refused so the bar shows exactly what runs. Unanswered asks expire after 5 minutes.
- The only listening port is the app's MCP server: `127.0.0.1` only, a random port and a fresh token each launch (in `%APPDATA%\ai-command-center\mcp.json`, deleted on quit), and every call without the token is refused. Every call, answered or refused, is logged to the sidebar's MCP tab and `%APPDATA%\ai-command-center\logs\mcp.log` (one JSON line each, arguments clipped to 300 characters, rotated at 5 MB). Its `open_file` tool passes Hub node ids, never paths, and can't open a file with its default app, so an agent can't launch a script that way. `read_tab` and `terminal_read` show an agent what you see, a page's text or a terminal's output, so they carry whatever is on screen, and their descriptions tell the model that it's content, not instructions. Project Hub is reached over loopback from the main process.
- Crashes and errors in the app's own processes go to `%APPDATA%\ai-command-center\logs\app.log`, nowhere else: no telemetry.
- Cronsole's MCP server is the only process the app starts besides the terminals: this app's own Electron binary running the script named by `ACC_CRONSOLE_MCP`, which only the user's environment can set. It talks over stdin and stdout and listens on nothing, and the app calls only its read-only `list_tasks`, plus `run_task` for a task you've clicked Run for; the task id never comes from the click, only the yes.
- The chat panel's API key is read from the environment by the main process and goes only to `api.anthropic.com`; it's never sent to the shell UI or written to disk. The chat's tool calls go through the MCP server with its token, so they're logged and confirmed like any other agent's, and Claude's replies are shown as plain text, never HTML.

## ⚖️ Licence

GPL-3.0-or-later. See [LICENSE](LICENSE).

The browser's Chrome extension support comes from [electron-chrome-extensions](https://github.com/samuelmaddock/electron-browser-shell), which is available under GPL-3.0 or a paid licence. This project uses the GPL terms, so the app is GPL too: you can use, change and share it, and anything you distribute that's built from it has to ship its source under the same licence. The reasoning is in [ADR-001](docs/decisions/adr-001-electron-shell.md#consequences).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<p align="center">
  Part of <a href="https://github.com/ai-automation-tools">ai-automation-tools</a> · Built on <a href="https://www.electronjs.org">Electron</a>, <a href="https://xtermjs.org">xterm.js</a>, <a href="https://github.com/samuelmaddock/electron-browser-shell">electron-chrome-extensions</a> · <a href="LICENSE">GPL-3.0-or-later</a> · <a href="docs/README.md">Docs</a>
</p>
