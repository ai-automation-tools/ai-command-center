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

Phase 1 done, Phase 2 started (merged in PRs #1 and #2). Tab restore, the launcher and the live MCP server's token check were confirmed by hand on 2026-09-30. The read-only and navigation MCP tools followed in weekly roadmap PRs the same day, and `terminal_run` on 2026-10-04. Next up: the MCP call log.

**Added**

- `terminal_run` MCP tool: a bar over the terminal shows the command and which terminal it goes to, and nothing runs until you click Run. Run types the line into the active PowerShell (or a new one) and Deny, which has focus, returns a tool error; asks queue one at a time and expire after 5 minutes. The command stays in the main process, so the click only picks a terminal, and newlines, tabs, escapes, bidi overrides and zero-width characters are refused so what's shown is what runs. No process is started with arguments. It returns once the line is typed, without the output. `src/shared/confirm.js` holds the pending asks; 6 new tests, and `npm run smoke` calls the tool and clicks Run. *(roadmap: Phase 2)*
- Navigation MCP tools: `open_tab` takes what the address bar takes (URL, Windows path, `localhost:<port>`, host or search) and opens it as a tab, in the background if asked; only http, https and file pages, so about: and extension pages stay the user's. `open_file` opens a Hub node id from `sidebar_search` in VS Code or reveals it in Explorer, adds it to Recent like a sidebar click, and refuses paths, `..`, UNC and virtual ids and Hub's open-with-default-app, which would run a script without a click. 7 new tests; `npm run smoke` calls `open_tab`. *(roadmap: Phase 2)*
- Read-only MCP tools: `list_tabs` (id, URL, title, loading, active), `sidebar_search` (the sidebar's search over Hub's files, the chosen bookmarks source and Recent, with absolute paths and an `errors` list when Hub is down) and `recent` (filter by type, limit). They live in `src/shared/tools.js` with 8 tests; the sidebar and `sidebar_search` now share one `searchAll` in `src/shared/tree.js`, and `npm run smoke` calls all three against the running app. *(roadmap: Phase 2)*
- Control Center MCP server: the main process starts it on `127.0.0.1` with a random port and a fresh token each launch, writes both to `%APPDATA%\ai-command-center\mcp.json`, and removes the file on quit. Calls without the token get 401, and a non-loopback Host header gets 403. Built on `node:http` with no new dependency. *(roadmap: Phase 2)*
- `scripts/Start-AICommandCenter.ps1` starts the app through the repo's own `electron.exe` with no console window left open; the README has the shortcut target line. *(roadmap: Phase 1)*
- Browser tabs reopen after a restart: the URLs and the active tab are saved to `layout.json` when the window closes and restored once the shell is ready. Blank pages and disallowed schemes are dropped, and `src/shared/session.js` has 4 tests. *(roadmap: Phase 1)*
- Licensed GPL-3.0-or-later: `LICENSE` with the unmodified GPL-3.0 text, `package.json` updated, and a Licence section in the README explaining the GPL dependency. *(roadmap: Public release)*

**Fixed**

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
