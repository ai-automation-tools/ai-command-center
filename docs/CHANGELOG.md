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

**Added**

- Licensed GPL-3.0-or-later: `LICENSE` with the unmodified GPL-3.0 text, `package.json` updated, and a Licence section in the README explaining the GPL dependency. *(roadmap: Public release)*

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
