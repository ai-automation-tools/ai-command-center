<h1 align="center">🗺️ Roadmap</h1>

<p align="center">
  <em>Everything between today's Phase 1 slice and a public release on ai-automation-tools.dev.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/now-public_release_checklist-F59E0B?style=for-the-badge" alt="Now: public release checklist">
  <img src="https://img.shields.io/badge/stage-incubating_(private)-8B5CF6?style=for-the-badge" alt="Stage: incubating, private">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

Ordered by what blocks what; [build-plan.md](product/build-plan.md) has the reasoning. **Every item above `## After public release` is a release gate:** the org pipeline's graduate stage makes the repo public once all of them are `- [x]` on `main` and Mike approves. A weekly roadmap routine (`\AI-Automation-Tools-Org\Update-Existing-Projects\AI-Command-Center Weekly Roadmap`, Wednesday 20:00) takes the first open gate each week and opens a PR; the org PR sweep merges it. Items marked 🔒 need Mike and are skipped by the routine. Completed items stay ticked, and each has a line in the [changelog](CHANGELOG.md).

> [!NOTE]
> **Where we are, 2026-10-05.** Phases 0 to 2 and the daily-use gates are done (see the changelog for the trail). A repo review on 2026-10-05 added three gates (page permissions denied by default, a crash log, and the browser shortcuts a daily browser can't do without), a new **Phase 2b** that closes the agent's loop (an agent can run a command today but can't read the result, read a page, or trigger a Cronsole task), and an **Integrations** list built on APIs Hub and Cronsole already expose. The same day: CI, the settings file, SECURITY.md, the permission handler, the crash log, the shortcuts, find in page, and the `list_terminals`, `terminal_read`, `read_tab`, `cron_tasks` and `cron_run` tools landed. **Next:** the live demo, the last gate.

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
- [x] Navigation tools: `open_tab`, `open_file` (through Hub's `/api/open`) — 2026-09-30, weekly roadmap run; unit-tested, and `npm run smoke` calls `open_tab` against the live app
- [x] `terminal_run`: shows the command in the app and waits for a click before running it — 2026-10-04; unit-tested, and `npm run smoke` calls it and clicks Run
- [x] Every MCP call written to an in-app log panel and to `%APPDATA%\ai-command-center\logs\mcp.log` — 2026-10-04; the sidebar's MCP tab and a JSON-lines file, refused calls included; unit-tested, and `npm run smoke` compares the panel with the file
- [x] README section with the `claude mcp add` line, so Claude Code in the app's terminal can drive the app — 2026-10-04; the app's terminals carry `ACC_MCP_URL` and `ACC_MCP_TOKEN` and the line stores the variable names, so it survives restarts; checked by connecting `claude` to the running app with the README's command
- [x] Chat panel wired to the MCP server (Claude first; model and key read from the user environment, never stored in the repo) — 2026-10-04, weekly roadmap run; a Chat tab in the sidebar, tools through the MCP server over HTTP with its token. Unit-tested against a real MCP server with a scripted model, and `npm run smoke` opens the tab; not yet run against the live API, which needs Mike's key
- [x] Cronsole: its task list in the sidebar through the Cronsole MCP server, and its UI in a pinned tab — 2026-10-04, weekly roadmap run; a Cron tab that starts Cronsole's stdio MCP server from `ACC_CRONSOLE_MCP` and lists `list_tasks`, and an Open Cronsole button that keeps one pinned tab. Unit-tested against a fake stdio server; `npm run smoke` listed 452 tasks from the live Cronsole and checked the pinned tab

## 🧰 Daily use

Found using the app on 2026-10-04 and made release gates the same day.

- [x] Right-click menu on Files rows: the hover actions (Terminal here, VS Code, Reveal in Explorer, open in tab) plus copy path and copy Hub id — 2026-10-04; native menu, items unit-tested
- [x] Open a folder or file in the content area under the app's own sidebar, not Project Hub's whole page: Hub renders the file (`/api/file`), the app shows it as a script-free `acc://doc` page in a tab, folders as a listing — 2026-10-04; `npm run smoke` clicks a Markdown file and checks the page (no second sidebar, images load)
- [x] New-terminal button with a menu of shells: PowerShell 7, Windows PowerShell, Command Prompt, and Git Bash when installed. Each is a fixed profile in `src/shared/shells.js`; the renderer sends a profile id, never a path or arguments — 2026-10-04; unit-tested, `npm run smoke` starts a Command Prompt session

## 🚦 Public release

- [x] CI workflow (`.github/workflows/ci.yml`) running `npm run lint` and `npm test` on push and PR, and passing; `npm audit` as a non-blocking step that reports the known `adm-zip` advisories until they're fixed — 2026-10-05; Ubuntu and Windows, Node 24, no Electron download; passing is confirmed on the first push
- [x] Nothing personal in tracked files: Project Hub URL and the empty-state quick links move to a settings file with neutral defaults; no absolute local paths anywhere — 2026-10-05; `%APPDATA%\ai-command-center\settings.json` read by `src/shared/settings.js` (3 tests), `ACC_HUB_URL` still wins, the Hub-down note points at the Project Hub repo, and the test hosts are `example.com`
- [x] README usage section rewritten for someone who isn't Mike, and verified against the real code — 2026-10-05; prerequisites and a clone-to-run quick start, what works without Hub, where the app's files live, a Contributing section in place of Mike's branch, and every claim checked against `src/`
- [x] `SECURITY.md`, plus a full-history secret scan (gitleaks) that comes back clean — 2026-10-05; 17 commits, no leaks; `npm run scan:secrets` keeps the command
- [x] Page permissions denied by default: the browse session gets a `setPermissionRequestHandler` that refuses camera, microphone, location, notifications, MIDI, USB, serial, HID and the rest, and allows only fullscreen, pointer lock and clipboard writes. Without a handler Electron grants everything a page asks for. Found in the 2026-10-05 review — 2026-10-05; request, check and device handlers, allowlist in `src/shared/permissions.js` with a test
- [x] Crash and error log: `uncaughtException`, `unhandledRejection`, a renderer or tab process going away, and `[startup] failed` appended to `%APPDATA%\ai-command-center\logs\app.log`, so a stranger's bug report has something to paste. Moved up from Distribution in the 2026-10-05 review — 2026-10-05; `src/main/applog.js`, which `mcp.log` now shares
- [x] Browser shortcuts a daily browser can't do without: Ctrl+Tab and Ctrl+Shift+Tab cycle tabs, Ctrl+1 to Ctrl+8 pick a tab and Ctrl+9 the last, Ctrl+Shift+T reopens the last closed tab, Ctrl+plus, Ctrl+minus and Ctrl+0 zoom the page. All in the app menu except where PowerShell needs the key. Found in the 2026-10-05 review — 2026-10-05; cycling and picking follow the strip's order in `src/shared/session.js` (2 tests), the last 10 closed tabs are kept
- [x] Find in page: Ctrl+F opens a find bar over the content area (`webContents.findInPage`), Enter and Shift+Enter step through matches, Escape closes it. Found in the 2026-10-05 review — 2026-10-05; the bar sits in the address row with a match count, closes when the tab changes; `npm run smoke` types a word and reads the count
- [ ] Live demo on GitHub Pages at `https://ai-automation-tools.dev/ai-command-center/`, served from this repo: the shell UI running in a browser with a mocked `window.acc` and fabricated files, bookmarks and terminal output; carries the org source bar; makes no network calls that need secrets. The renderer's absolute `/sidebar.js` and `/vendor/…` imports have to become relative first, so the same files serve under `acc://shell/` and under a Pages subpath
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

**Phase 2b: close the agent's loop**

Added in the 2026-10-05 review. Today an agent can type a command and open things, but it can't see what happened: `terminal_run` returns before the output, `list_tabs` gives URLs without content, and the "trigger a Cronsole task" the harness promised in [requirements.md](decisions/requirements.md#features) never landed. Each item here is read-only or sits behind the same click as `terminal_run`.

- [x] `list_terminals` and `terminal_read`: the open terminal sessions (id, shell, folder, whether PowerShell, whether exited) and the last N lines of one session's output with ANSI escapes stripped, from a ring buffer the main process keeps per session. Read-only, no click. Closes the loop for "run `npm test` and tell me what failed" — 2026-10-05; `src/shared/output.js` cleans the output (4 tests), the tools have 1 test, and `npm run smoke` reads back what `terminal_run` printed
- [x] `read_tab`: the visible text of a tab (`document.body.innerText`, clipped to a size limit) plus its title and URL, so the chat can summarise or quote the page it's looking at. The tool description says the text is untrusted page content, not instructions — 2026-10-05; 1 test, and `npm run smoke` reads example.com back
- [x] `cron_run`: start a Cronsole task through Cronsole's own `run_task`, shown on the confirm bar like a command and run only after the click; `cron_tasks` as the read-only list the Cron tab already has. The task id stays in the main process; the click only answers yes or no — 2026-10-05; `runTask` in `src/shared/cronsole.js` (2 tests) and the tools (2 tests); `npm run smoke` calls `cron_tasks`
- [ ] Chat: a "+ page" and "+ terminal" button that attaches `read_tab` or `terminal_read` output to the next message, so "what does this page say" needs no tool round-trip
- [ ] Chat: stream the reply as it arrives, trim old turns past a token budget, and keep the last conversation across restarts in `chat.json`
- [ ] MCP `tools/list` carries `annotations` (`readOnlyHint`, `destructiveHint`, `openWorldHint`) so clients can show which tools look and which act

**Integrations** (APIs the neighbours already expose, found in the 2026-10-05 review)

- [ ] Project Hub's `/api/events` stream: the sidebar subscribes once and reloads the tree on `change`, so a rescan shows up without Retry and the document index in `src/main/docs.js` drops its 30 s cache
- [ ] Star the current page: a ☆ in the address bar that adds the tab to Hub's favorites through `PUT /api/favorites`, so the app's own bookmarks source gains entries without opening Hub
- [ ] Links in the terminal open as tabs: an xterm `registerLinkProvider` for `http(s)://` and `localhost:<port>` text, so the address a dev server prints is one click from a tab. No new dependency; mark `- [!]` and use `@xterm/addon-web-links` (MIT) if the hand-written provider misses cases
- [ ] Cronsole rows show the last run's result: `get_task_history` on hover or click, with `get_run_output` behind a "Show output" that opens as an `acc://doc`-style page
- [ ] A count of failed Cronsole tasks on the Cron tab's label, refreshed on the same timer as the Hub health dot
- [ ] Claude Code in the terminal: when `claude` registers with the MCP server, the MCP tab's first row says which client connected (`initialize`'s `clientInfo`), so the log reads "claude-code 2.x connected" rather than two ✗ rows

**Phase 3: the rest**

- [ ] IDE pane: code-server or OpenVSCode Server in a tab, started on demand, loopback only
- [ ] Docs upkeep view: last run and report of the docs-maintenance jobs
- [ ] AI news panel and AI bookmarks feed, read from configurable RSS or Markdown sources
- [ ] Phone channel through an existing gateway (Claude Remote Control, Hermes or OpenClaw) connected to the MCP server

**Daily use, round 2** (nice to have; found in the 2026-10-05 review)

- [ ] Address bar suggestions from Recent and bookmarks as you type, picked with the arrow keys
- [ ] Tabs: drag to reorder, duplicate, mute, and pin any tab (today only Cronsole's is pinned)
- [ ] Downloads: `will-download` handled so a finished download shows a toast with Reveal in Explorer, and lands in Recent
- [ ] Light theme for the shell, following `prefers-color-scheme` the way document pages already do
- [ ] Terminal search with `@xterm/addon-search` (MIT) — `- [!]` needs a dependency

**Code health** (from the 2026-10-05 review)

- [ ] Move the smoke routine out of `src/main/main.js` into `src/main/smoke.js`; it's 150 lines of a 490-line file that CLAUDE.md says should stay thin
- [ ] Test counts in `README.md`, `tests/README.md` and `CLAUDE.md` drift apart (65+, 74 and 80 on 2026-10-05). Say "80+" once in `tests/README.md` and drop the number elsewhere, or print it from CI

**Distribution and promotion**

- [ ] Windows installer with electron-builder, published as a GitHub release
- [ ] 🔒 Code-signing certificate (costs money)
- [ ] Electron upgrade drill done once, following ADR-001's checklist
- [ ] Launch post for the ai-automation-tools.dev landing page

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="CHANGELOG.md">Changelog →</a>
</p>
