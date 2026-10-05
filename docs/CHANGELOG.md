<h1 align="center">📋 Changelog</h1>

<p align="center">
  <em>Every change to the app, newest first.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-2ea44f?style=for-the-badge" alt="Version 0.1.0">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

Entries tagged with a phase in italics came off the [roadmap](ROADMAP.md).

## Unreleased

Phase 1 done, Phase 2 started (merged in PRs #1 and #2). Tab restore, the launcher and the live MCP server's token check were confirmed by hand on 2026-09-30. The read-only and navigation MCP tools followed in weekly roadmap PRs the same day, and `terminal_run` on 2026-10-04, along with the daily-use gates (Files right-click menu, documents under the app's own sidebar, shell menu) and a fix to the page context menu's open-externally item, then the MCP call log and the README's `claude mcp add` section, the chat panel, and Cronsole in the sidebar, which finished Phase 2. Next up: the public-release checklist.

**Added**

- Cronsole in the app: a **Cron** tab in the sidebar lists Cronsole's scheduled tasks through Cronsole's own MCP server (its `list_tasks` tool), with the next run, or paused, missing or failed, on each row and the details on hover. The server is the script `ACC_CRONSOLE_MCP` names, run on the app's own Electron binary in Node mode over stdio, started on the tab's first open and stopped on quit; it reads `CRONSOLE_TOKEN` from the environment as it does under Claude Code. **Open Cronsole** or a click on a task shows Cronsole's UI (`ACC_CRONSOLE_UI`, default `http://localhost:7373`) in a pinned tab: first in the strip, no close button, reused rather than duplicated, and pinned again after a restart. The stdio JSON-RPC client is hand-written with no new dependency; `src/shared/cronsole.js` has it, with 6 tests, and `npm run smoke` checks the tab and the pinned tab against the running app. *(roadmap: Phase 2)*

- Chat panel: a **Chat** tab in the sidebar where Claude drives the app through its own MCP server, so a message can open a tab, search or open a file, or put a command on the terminal's Run bar. The key (`ACC_CHAT_API_KEY` or `ANTHROPIC_API_KEY`) and model (`ACC_CHAT_MODEL` or `ANTHROPIC_MODEL`) come from the environment, with no default model; the key stays in the main process. Tool calls go over HTTP with the MCP token, so they're logged in the MCP tab and `terminal_run` still waits for a click. Built on `fetch` with no new dependency. `src/shared/chat.js` has the turn loop, with 9 tests including one against a real MCP server; `npm run smoke` opens the tab. *(roadmap: Phase 2)*
- Drive the app from Claude Code: every terminal the app opens gets `ACC_MCP_URL` and `ACC_MCP_TOKEN` for this launch, and the README's new section registers the server once with `claude mcp add --scope user --transport http ai-command-center '${ACC_MCP_URL}' --header 'Authorization: Bearer ${ACC_MCP_TOKEN}'`. Claude Code expands the variables each time it starts, so the random port and token stop mattering; the section also covers using it from other terminals and the two expected ✗ rows a connect leaves in the MCP panel. The MCP server now starts before the shell loads, so the first terminal has the variables too. *(roadmap: Phase 2)*
- MCP call log: every request to the MCP server, answered, failed or refused (no token, wrong Host, bad JSON), shows newest first in a new **MCP** tab in the sidebar, with the tool, its arguments, time taken and any error, and is appended to `%APPDATA%\ai-command-center\logs\mcp.log` as one JSON line. Arguments and errors are clipped to 300 characters; the file moves to `mcp.log.1` past 5 MB. The server reports calls through an `onCall` hook in `src/shared/mcp.js`; `src/shared/mcplog.js` has the entry format, with 5 tests, and `npm run smoke` checks the panel against the file. *(roadmap: Phase 2)*
- Shell menu on the terminal strip: the ⌄ next to ＋ opens PowerShell 7, Windows PowerShell, Command Prompt or Git Bash, whichever are installed. Each is a fixed profile in `src/shared/shells.js` picked by id, so no message can name an executable or pass arguments; `terminal_run` only types into PowerShell sessions, checked in the main process. *(roadmap: Daily use)*
- Documents open under the app's own sidebar: clicking a file (or 👁 on any row) shows it in a tab as an `acc://doc/<Hub id>` page. Hub renders the Markdown through `/api/file`; other text shows as code, images inline, folders as a listing, and relative links and images resolve because the address mirrors the Hub id. One tab is reused as you click through; Ctrl+click opens another. The pages run no scripts, can't be framed, can't be reached from a web page, and serve only files in Hub's index. HTML files still open as pages, and VS Code moves to the hover buttons and the menu. *(roadmap: Daily use)*
- Right-click menu on Files rows: View here, open raw file or page in a tab, VS Code, Reveal in Explorer, Terminal here, Copy path, Copy Project Hub id. It's a native menu, so it draws over the browser pane. *(roadmap: Daily use)*
- `terminal_run` MCP tool: a bar over the terminal shows the command and which terminal it goes to, and nothing runs until you click Run. Run types the line into the active PowerShell (or a new one) and Deny, which has focus, returns a tool error; asks queue one at a time and expire after 5 minutes. The command stays in the main process, so the click only picks a terminal, and newlines, tabs, escapes, bidi overrides and zero-width characters are refused so what's shown is what runs. No process is started with arguments. It returns once the line is typed, without the output. `src/shared/confirm.js` holds the pending asks; 6 new tests, and `npm run smoke` calls the tool and clicks Run. *(roadmap: Phase 2)*
- Navigation MCP tools: `open_tab` takes what the address bar takes (URL, Windows path, `localhost:<port>`, host or search) and opens it as a tab, in the background if asked; only http, https and file pages, so about: and extension pages stay the user's. `open_file` opens a Hub node id from `sidebar_search` in VS Code or reveals it in Explorer, adds it to Recent like a sidebar click, and refuses paths, `..`, UNC and virtual ids and Hub's open-with-default-app, which would run a script without a click. 7 new tests; `npm run smoke` calls `open_tab`. *(roadmap: Phase 2)*
- Read-only MCP tools: `list_tabs` (id, URL, title, loading, active), `sidebar_search` (the sidebar's search over Hub's files, the chosen bookmarks source and Recent, with absolute paths and an `errors` list when Hub is down) and `recent` (filter by type, limit). They live in `src/shared/tools.js` with 8 tests; the sidebar and `sidebar_search` now share one `searchAll` in `src/shared/tree.js`, and `npm run smoke` calls all three against the running app. *(roadmap: Phase 2)*
- Control Center MCP server: the main process starts it on `127.0.0.1` with a random port and a fresh token each launch, writes both to `%APPDATA%\ai-command-center\mcp.json`, and removes the file on quit. Calls without the token get 401, and a non-loopback Host header gets 403. Built on `node:http` with no new dependency. *(roadmap: Phase 2)*
- `scripts/Start-AICommandCenter.ps1` starts the app through the repo's own `electron.exe` with no console window left open; the README has the shortcut target line. *(roadmap: Phase 1)*
- Browser tabs reopen after a restart: the URLs and the active tab are saved to `layout.json` when the window closes and restored once the shell is ready. Blank pages and disallowed schemes are dropped, and `src/shared/session.js` has 4 tests. *(roadmap: Phase 1)*
- Licensed GPL-3.0-or-later: `LICENSE` with the unmodified GPL-3.0 text, `package.json` updated, and a Licence section in the README explaining the GPL dependency. *(roadmap: Public release)*

**Fixed**

- A page's right-click "Open link in default browser" passed any link to Windows, so a `file:` or `ms-*:` link could launch a program; it's now http and https only. "Open link in new tab" now goes through the same navigation check as clicks.
- A second launch while the app was running started its own MCP server and overwrote `mcp.json` with a port that died a moment later. It now exits before doing anything else.
- `Start-AICommandCenter.ps1` no longer prints Electron's log output into the terminal it was run from; it goes to `%APPDATA%\ai-command-center\logs\launch.out.log` and `launch.err.log`.
- Closing the window or a tab no longer pops up "A JavaScript error occurred in the main process: Object has been destroyed". electron-chrome-extensions closes a tab again from its `destroyed` event, after the window is destroyed and the view's `webContents` is already undefined; `Tabs.close()` now skips whatever is gone.

## 0.1.0 — 2026-09-29

**Added**

- Requirements, three architecture options, and three ADRs: Electron shell, Project Hub over HTTP, terminal in the main process. *(roadmap: Phase 0)*
- One Electron 44 window with a sidebar, browser tab strip, address bar and terminal panel; the splitter sizes are remembered. *(roadmap: Phase 1)*
- Browser tabs in their own sandboxed session, with back, forward, reload, links opening as tabs, a context menu, and a button that opens the page in the default browser. *(roadmap: Phase 1)*
- Chrome extension support: the Web Store's install button works in a tab, and installed extensions load at start with their toolbar icons. *(roadmap: Phase 1)*
- PowerShell 7 terminals in tabs, openable in any folder from the sidebar. *(roadmap: Phase 1)*
- Files panel from Project Hub's scan, with open in VS Code, reveal in Explorer, and HTML files opening in a tab. *(roadmap: Phase 1)*
- Bookmarks panel reading Chrome, Edge or Brave through Hub, or Hub's favorites. *(roadmap: Phase 1)*
- Recent list of pages, files and terminals, and one search box across files, bookmarks and recent. *(roadmap: Phase 1)*
- `npm test` with 18 unit tests for the tree, URL and recent helpers, and `npm run smoke`, which launches the app, drives the sidebar, saves screenshots and quits. *(roadmap: Phase 1)*
- `npm run spike:extensions`, which installs LastPass and Rakuten and reports what happens.
- `npm run lint` (`node --check` over every JavaScript file), `CLAUDE.md` for the agent that works this repo each week, and `docs/product/` with the spec and build plan. *(roadmap: Phase 1)*

**Changed**

- Moved into the ai-automation-tools org pipeline: the repo is now `ai-automation-tools/ai-command-center` (private, transferred from a personal account the same day, with secret scanning, push protection and Dependabot alerts verified on) and the local clone sits in the org's `Draft/` incubator. *(roadmap: Phase 1)*
- The roadmap now marks everything above `## After public release` as a release gate; LastPass support, Mike's daily-use checks and Phase 3 moved below it.

**Fixed**

- The app no longer hangs on quit. node-pty's console-list helper crashed during shutdown (`AttachConsole failed`); the terminal now uses the bundled ConPTY, and the app exits explicitly once every window and session is closed.
- A long search result list no longer pushes the terminal panel off the bottom of the window.

**Known issues**

- LastPass and Rakuten install and show toolbar icons, but their background service workers crash on start: Electron 44 doesn't run preloads in extension service workers, so `chrome.windows` is missing. See [ADR-001](decisions/adr-001-electron-shell.md#spike-result-2026-09-29).

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="ROADMAP.md">← Roadmap</a>
</p>
