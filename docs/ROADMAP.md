<h1 align="center">🗺️ Roadmap</h1>

<p align="center">
  <em>Everything between today's Phase 1 slice and an app Mike works from all day.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/now-Phase_1_·_first_slice-F59E0B?style=for-the-badge" alt="Now: Phase 1, first slice">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

Ordered by what blocks what. Phases follow the build prompt (`Repos/Private/Draft/AI-Command-Center/Prompts/initial-build.md`, kept local); rankings come from [requirements.md](decisions/requirements.md). This is a personal tool in a private repo, so there's no publish or monetize phase. A public release needs a licence decision first (see **Later**). Completed items stay ticked here until their phase closes, and each one has a line in the [changelog](CHANGELOG.md).

## 🧭 Phase 0: decide (done 2026-09-29)

- [x] Requirements ranked must / should / later, with reasons ([requirements.md](decisions/requirements.md))
- [x] Three candidate architectures compared on extensions, IDE, build hours and upkeep ([architecture-options.md](decisions/architecture-options.md))
- [x] Runtime chosen and recorded ([ADR-001](decisions/adr-001-electron-shell.md)), plus Hub integration ([ADR-002](decisions/adr-002-hub-over-http.md)) and terminal ([ADR-003](decisions/adr-003-terminal-in-main.md))

## 🔨 Phase 1: one window (in progress)

**Built and smoke-tested 2026-09-29**

- [x] One Electron window: sidebar, tab strip, address bar, terminal panel, resizable splitters that remember their size
- [x] Browser tabs with back, forward, reload, new-tab links, a context menu, and "open in default browser"
- [x] Web Store install button works inside a tab; installed extensions load at start and show toolbar icons
- [x] PowerShell 7 terminals in tabs, opened in any folder from the sidebar ("Terminal here")
- [x] Files panel from Project Hub's scan: lazy tree, keyboard navigation, open in VS Code, reveal in Explorer, HTML opens in a tab
- [x] Bookmarks panel: Chrome, Edge or Brave profile (read by Hub), or Hub favorites
- [x] Recent: pages, files and terminals, newest first, kept across restarts
- [x] Search across files, bookmarks and recent from one box
- [x] `npm test` (18 unit tests) and `npm run smoke` (launch, open a page and a terminal, drive the sidebar, screenshot, quit)

**Left in Phase 1**

- [ ] **LastPass and Rakuten working in a tab.** Blocked: their MV3 service workers crash because Electron 44 doesn't run preloads in extension service workers ([ADR-001](decisions/adr-001-electron-shell.md#spike-result-2026-09-29)). Rerun `npm run spike:extensions` on each Electron major; until then, ↗ opens the page in Chrome.
- [ ] Mike uses the app as his main window for 3 working days and logs what breaks in the table below
- [ ] Terminal checked by hand: typing, resize, colors, copy/paste, and `claude` running in it
- [ ] Tab order survives a restart (reopen the tabs that were open)
- [ ] A Start-menu shortcut or `Start-AICommandCenter.ps1` so launching doesn't need a terminal

| Day | Used as main window? | What broke or got in the way |
|:---|:--:|:---|
| | | |

## 🤖 Phase 2: harness

- [ ] Control Center MCP server on `127.0.0.1` with a per-launch token: `open_tab`, `list_tabs`, `open_file`, `terminal_run` (with confirmation), `sidebar_search`, `cronsole_run_task`
- [ ] Every command an agent runs through the MCP server is written to a log Mike can read in the app
- [ ] Destructive actions (closing tabs, running commands) need a click to confirm
- [ ] Direct chat panel wired to that server (Claude first; the model behind it swappable)
- [ ] Cronsole's UI in a pinned tab, and its task list in the sidebar through its MCP server
- [ ] `claude mcp add` instructions in the README so Claude Code in the terminal can drive the app too

## 🧩 Phase 3: the rest

- [ ] IDE pane: code-server or OpenVSCode Server in a tab, started on demand, loopback only
- [ ] Docs upkeep view: last run and report of the four `\AI-Maintenance\Docs\` jobs
- [ ] AI news panel reading the Library's weekly AI digests
- [ ] AI bookmarks feed from the Library's monthly link lists
- [ ] Phone channel: pick one of Claude Remote Control, Hermes (Telegram) or OpenClaw, and connect it to the MCP server

## 🚦 Ready for daily use

- [ ] Crash and error log written to `%APPDATA%\ai-command-center\logs`
- [ ] `npm audit` clean or each advisory written up (today: `adm-zip` via electron-chrome-web-store, no fix available)
- [ ] Electron upgrade drill done once, following ADR-001's checklist
- [ ] If the app ever starts from a scheduled task, add that task to `$repoServiceTasks` in `Sync-Repos.ps1` so the 07:00 sync stops it before touching the repo
- [ ] Card in the apex page's Other Repos grid and a row in `docs/LINKS.md` (the workspace rule for `Other_Apps/`), once Mike decides a private repo should be listed there
- [ ] README rewritten from "what's being built" to "how to use it"

## 🔭 Later

- [ ] Recheck electron/electron#44411 and electron-chrome-extensions releases monthly; remove the LastPass blocker when either ships
- [ ] If LastPass is still blocked after Phase 2, evaluate driving an external Chrome from the browser pane
- [ ] If this should ever be shared: choose a licence compatible with GPL-3.0, or buy the electron-chrome-extensions patron licence, before any public repo
- [x] Git repo with a private remote, `michaelschecht/ai-command-center`; moved out of `Draft/` to `Repos/Private/Other_Apps/`

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="CHANGELOG.md">Changelog →</a>
</p>
