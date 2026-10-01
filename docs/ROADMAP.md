<h1 align="center">🗺️ Roadmap</h1>

<p align="center">
  <em>Everything between today's Phase 1 slice and a public release on ai-automation-tools.dev.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/now-Phase_2_·_harness-F59E0B?style=for-the-badge" alt="Now: Phase 2, harness">
  <img src="https://img.shields.io/badge/stage-incubating_(private)-8B5CF6?style=for-the-badge" alt="Stage: incubating, private">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

Ordered by what blocks what; [build-plan.md](product/build-plan.md) has the reasoning. **Every item above `## After public release` is a release gate:** the org pipeline's graduate stage makes the repo public once all of them are `- [x]` on `main` and Mike approves. A weekly roadmap routine (`\AI-Automation-Tools-Org\Update-Existing-Projects\AI-Command-Center Weekly Roadmap`, Wednesday 20:00) takes the first open gate each week and opens a PR; the org PR sweep merges it. Items marked 🔒 need Mike and are skipped by the routine. Completed items stay ticked, and each has a line in the [changelog](CHANGELOG.md).

> [!NOTE]
> **Where we are, 2026-09-30.** Phase 1 is done, and Mike checked tab restore and the launcher by hand in the real app. Phase 2 has started: the MCP server runs with its token check, confirmed live against a running app, and answers the read-only tools `list_tabs`, `sidebar_search` and `recent` (the weekly roadmap PR of 2026-09-30). **Next:** the navigation tools `open_tab` and `open_file`.

## 🧭 Phase 0: decide

- [x] Requirements ranked must / should / later, with reasons ([requirements.md](decisions/requirements.md)) — 2026-09-29
- [x] Three candidate architectures compared ([architecture-options.md](decisions/architecture-options.md)) — 2026-09-29
- [x] Runtime, Hub integration and terminal recorded as ADR-001 to ADR-003 — 2026-09-29

## 🔨 Phase 1: one window

- [x] One Electron window: sidebar, tab strip, address bar, terminal panel, splitters that remember their size — 2026-09-29
- [x] Browser tabs with back, forward, reload, links as tabs, context menu, open in default browser — 2026-09-29
- [x] Chrome Web Store installs inside a tab; installed extensions load at start with toolbar icons — 2026-09-29
- [x] PowerShell 7 terminals in tabs, openable in any sidebar folder — 2026-09-29
- [x] Files panel from Project Hub, with VS Code, Explorer and open-in-tab actions — 2026-09-29
- [x] Bookmarks panel (Chrome, Edge or Brave via Hub, or Hub favorites) — 2026-09-29
- [x] Recent list and one search box across files, bookmarks and recent — 2026-09-29
- [x] `npm test`, `npm run smoke`, `npm run spike:extensions` — 2026-09-29
- [x] `npm run lint` (`node --check` over every JS file) and `CLAUDE.md` for the weekly routine — 2026-09-29
- [x] Tabs that were open reopen after a restart (store the URLs in `layout.json`; unit-test the list handling in `src/shared/`) — 2026-09-30, checked by hand the same day
- [x] `Start-AICommandCenter.ps1` in `scripts/` that starts the app hidden-window-free, so launching doesn't need a terminal — 2026-09-30, checked by hand the same day

## 🤖 Phase 2: harness

- [x] Control Center MCP server started by the main process on `127.0.0.1`, random port and per-launch token written to `%APPDATA%\ai-command-center\mcp.json`; refuses calls without the token — 2026-09-30, live server checked by hand (401 without the token, `ping` answered with it)
- [x] Read-only tools first: `list_tabs`, `sidebar_search`, `recent` — 2026-09-30, weekly roadmap run; unit-tested and called against the live app by `npm run smoke`
- [ ] Navigation tools: `open_tab`, `open_file` (through Hub's `/api/open`)
- [ ] `terminal_run`: shows the command in the app and waits for a click before running it
- [ ] Every MCP call written to an in-app log panel and to `%APPDATA%\ai-command-center\logs\mcp.log`
- [ ] README section with the `claude mcp add` line, so Claude Code in the app's terminal can drive the app
- [ ] Chat panel wired to the MCP server (Claude first; model and key read from the user environment, never stored in the repo)
- [ ] Cronsole: its task list in the sidebar through the Cronsole MCP server, and its UI in a pinned tab

## 🚦 Public release

- [ ] CI workflow (`.github/workflows/ci.yml`) running `npm run lint` and `npm test` on push and PR, and passing
- [ ] Nothing personal in tracked files: Project Hub URL and the empty-state quick links move to a settings file with neutral defaults; no absolute local paths anywhere
- [ ] README usage section rewritten for someone who isn't Mike, and verified against the real code
- [ ] `SECURITY.md`, plus a full-history secret scan (gitleaks) that comes back clean
- [ ] Live demo on GitHub Pages at `https://ai-automation-tools.dev/ai-command-center/`, served from this repo: the shell UI running in a browser with a mocked `window.acc` and fabricated files, bookmarks and terminal output; carries the org source bar; makes no network calls that need secrets
- [x] Licence: GPL-3.0-or-later, chosen by Mike because electron-chrome-extensions is GPL-3.0; `LICENSE` added and `package.json` updated — 2026-09-29

## After public release

**Upstream blocker**

- [ ] LastPass and Rakuten working in a tab. Blocked on Electron running preloads in extension service workers ([ADR-001](decisions/adr-001-electron-shell.md#spike-result-2026-09-29)). Rerun `npm run spike:extensions` on every Electron major and tick this when both pass.

**🔒 Mike's own checks** (not gates; they decide whether to keep going, per [build-plan.md](product/build-plan.md#when-wed-stop))

- [ ] Use the app as the main window for 5 working days and fill in the log below
- [ ] Terminal checked by hand: typing, resize, colors, copy/paste, and `claude` running in it

| Day | Used as main window? | What broke or got in the way |
|:---|:--:|:---|
| | | |

**Phase 3: the rest**

- [ ] IDE pane: code-server or OpenVSCode Server in a tab, started on demand, loopback only
- [ ] Docs upkeep view: last run and report of the docs-maintenance jobs
- [ ] AI news panel and AI bookmarks feed, read from configurable RSS or Markdown sources
- [ ] Phone channel through an existing gateway (Claude Remote Control, Hermes or OpenClaw) connected to the MCP server

**Distribution and promotion**

- [ ] Windows installer with electron-builder, published as a GitHub release
- [ ] 🔒 Code-signing certificate (costs money)
- [ ] Crash and error log in `%APPDATA%\ai-command-center\logs`
- [ ] Electron upgrade drill done once, following ADR-001's checklist
- [ ] Launch post for the ai-automation-tools.dev landing page

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="CHANGELOG.md">Changelog →</a>
</p>
