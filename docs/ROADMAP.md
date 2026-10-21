<h1 align="center">🗺️ Roadmap</h1>

<p align="center">
  <em>Everything between today's Phase 1 slice and a public release on ai-automation-tools.dev.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/now-after_public_release-F59E0B?style=for-the-badge" alt="Now: after public release">
  <img src="https://img.shields.io/badge/stage-public_since_2026--10--18-2ea44f?style=for-the-badge" alt="Stage: public since 2026-10-18">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-docs_home-6B7280?style=for-the-badge" alt="Back to docs"></a>
</p>

---

Ordered by what blocks what; [build-plan.md](product/build-plan.md) has the reasoning. **Every item above `## After public release` is a release gate:** the org pipeline's graduate stage makes the repo public once all of them are `- [x]` on `main` and Mike approves. A roadmap routine (`\AI-Automation-Tools-Org\Update-Existing-Projects\Roadmaps\AI-Command-Center Weekly Roadmap`, Sunday and Wednesday 20:00) takes the first open item each run, gates first, and opens a `roadmap/auto-<date>` PR; the org PR sweep (Wednesday and Sunday 09:30) reviews and merges it, and the daily Graduate stage reads the gates on `main`. Items marked 🔒 need Mike and are skipped by the routine. Completed items stay ticked, and each has a line in the [changelog](CHANGELOG.md).

> [!NOTE]
> **Where we are, 2026-10-05.** Phases 0 to 2 and the daily-use gates are done (see the changelog for the trail). A repo review on 2026-10-05 added three gates (page permissions denied by default, a crash log, and the browser shortcuts a daily browser can't do without), a new **Phase 2b** that closes the agent's loop (an agent can run a command today but can't read the result, read a page, or trigger a Cronsole task), and an **Integrations** list built on APIs Hub and Cronsole already expose. The same day: CI, the settings file, SECURITY.md, the permission handler, the crash log, the shortcuts, find in page, and the `list_terminals`, `terminal_read`, `read_tab`, `cron_tasks` and `cron_run` tools landed. On 2026-10-07 the live demo, the last gate, was built (`src/demo/`, `npm run demo`) and held 🔒. On 2026-10-18 Mike lifted the hold: the `adm-zip` gate closed, the demo went live on Pages, and every release gate is ticked, so the graduate stage can ask for release approval. **2026-10-20:** MV3 extension workers run, extensions can be managed from a menu, ads are blocked, and a project audit added Milestones A to D below. **Next:** Milestone A, then the open Integrations items.

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
- [x] Clear the `adm-zip` advisories: it is a transitive dependency (the `electron-chrome-*` packages pin `^0.5.16`, lock has 0.5.18; first patched release 0.6.1, per the 8 open Dependabot alerts, 5 high). Add a `package.json` `overrides` entry for `adm-zip` at the patched version, regenerate the lockfile, confirm `npm run smoke` still loads an extension, and drop the `npm audit` carve-out from CI once it reports clean. Queued 2026-10-14 by the org automation audit — 2026-10-18; override `^0.6.1`, `npm audit` clean, CI audit now blocking, `npm run smoke` passed with both extensions loaded
- [x] 🔒 Live demo on GitHub Pages at `https://ai-automation-tools.dev/ai-command-center/`, served from this repo: the shell UI running in a browser with a mocked `window.acc` and fabricated files, bookmarks and terminal output; carries the org source bar; makes no network calls that need secrets. The renderer's absolute `/sidebar.js` and `/vendor/…` imports have to become relative first, so the same files serve under `acc://shell/` and under a Pages subpath — **Held by Mike 2026-10-12: built, not deployed.** No Pages workflow and Pages stays off until Mike has validated the whole roadmap and says to go public; the routine must not add the workflow or enable Pages. Built 2026-10-07, roadmap run: `src/demo/` and `npm run demo` (builds `_site/`). 8 tests; checked by hand in a browser (sidebar, tabs, terminal `npm test`, confirm bar, chat, Cron) and `npm run smoke` passed with the relative paths. Hold lifted by Mike 2026-10-18: deployed by `.github/workflows/pages.yml` on every push to `main`
- [x] Licence: GPL-3.0-or-later, chosen by Mike because electron-chrome-extensions is GPL-3.0; `LICENSE` added and `package.json` updated — 2026-09-29

## After public release

### Upstream blocker

- [ ] 🔒 LastPass working in a tab. Its worker starts since the `browser` alias (2026-10-20, [ADR-001](decisions/adr-001-electron-shell.md#update-2026-10-20-the-browser-namespace)) and sign-in works, but on Mike's machine the toolbar popup's vault keeps spinning. A copy of the profile opened the vault fine in a test run, and `logs\extensions.log` shows only the worker's `document is not defined`, which comes from `chrome.offscreen.createDocument`, an API electron-chrome-extensions doesn't implement. Next step: implement `chrome.offscreen` (a hidden extension page per document) or wait for the library. Rakuten works, including Google sign-in, since pop-ups keep `window.opener` (2026-10-20). Rerun `npm run spike:extensions` on every Electron major. Mike's, because it needs his vault to check.

### 🔒 Mike's own checks

Not gates; they decide whether to keep going, per [build-plan.md](product/build-plan.md#when-wed-stop).

- [ ] Use the app as the main window for 5 working days and fill in the log below
- [ ] Terminal checked by hand: typing, resize, colors, copy/paste (keys and right-click), and `claude` running in it
- [ ] Ad blocking checked by hand on a few ad-heavy sites, and no site you use daily broken by it

| Day | Used as main window? | What broke or got in the way |
|:---|:--:|:---|
| | | |

### 🛡️ Milestone A: a trustworthy foundation

From a project audit on 2026-10-20 (the report stays outside the repo). These come before anything that gives agents more authority. Each item lands with tests for its failure cases.

- [ ] `terminal_run` runs exactly what was approved, where it said it would: the main process picks the target when the ask is made, not the renderer at click time, and by default runs the command in a fresh PowerShell terminal it opens (known folder, no half-typed input, no `claude` already running in it). A target that has gone away by the time of the click refuses rather than retargets. The click-to-run rule stays; ADR-003 records the change
- [ ] Agent `open_tab` opens http(s) only, and a web page can't navigate a tab or a pop-up to a `file:` URL. Local files reach an agent only through Hub's index (`open_file`, `acc://doc`); a person typing a `file:` path in the address bar still works
- [ ] One child-environment builder for terminals and Cronsole that strips the app's own credentials (`ANTHROPIC_API_KEY`, `ACC_CHAT_API_KEY`) even when they come from the real environment, keeps what Windows needs and adds the MCP address and token. Tested with fake values
- [ ] MCP request hardening: a non-object `params` or `arguments` gets `-32602`, every error at the HTTP boundary becomes a JSON-RPC error instead of an unhandled rejection, and the next request still works
- [ ] MCP conformance: `structuredContent` is always an object (or left out), requests with an `Origin` header that isn't loopback are refused, and a test drives the server the way a strict client would
- [ ] Chat Stop: a Stop button that aborts the model request and any MCP call in flight, withdraws a pending confirm, and leaves the panel ready for the next message; plus a deadline on each request. Stopping says so; it never claims to undo a command that already ran
- [ ] Less sensitive data at rest: `mcp.log` keeps `terminal_run`'s command and page text out (metadata and length only), strips URL query strings, and the chat's Clear deletes `chat.json`
- [ ] `npm run smoke` that fails when a check fails: a throwaway profile by default (`--profile` for the real one), each check an assertion, a JSON summary in `.smoke/`, a nonzero exit on any failure or on a no-op second-instance launch. Live Hub and Cronsole checks stay, opt-in
- [ ] Small fixes: CI's `npm audit` covers Electron (it's a devDependency but ships as the runtime); IPC also checks the sender is the shell's main frame; favorite toggles run one at a time; Hub request timers are cleared; `settings.json`'s `hubUrl` is loopback-only unless `ACC_HUB_REMOTE=1`; README status and Electron badge brought up to date

### 🧭 Milestone B: a project-centered shell

Selecting a project should set the folder, terminals, tabs and conversation together, rather than adding more sidebar panels.

- [ ] Named workspaces: a workspace is a Hub root plus its open tabs, terminal folders and conversation, saved in `workspaces.json` with a schema version. Switching restores them and never re-runs a command
- [ ] Command palette (Ctrl+K): actions, workspaces, files, tabs and terminals from one box
- [ ] Context tray: before a message goes, show exactly what's attached (page text, terminal lines) and where it's going, with a remove ✕ on each
- [ ] Connections view: Hub, Cronsole, each shell, the chat model and the MCP server, each with its state, a Retry and what to set when it's missing
- [ ] Conversations per workspace: named, listed and searchable, instead of one global `chat.json`
- [ ] Chat in a resizable right-hand pane, so it stays open beside Files

### 🧑‍💻 Milestone C: editing in the window

Replaces Phase 3's IDE line.

- [ ] 🔒 Editor ADR and spike: code-server publishes no Windows build, so test OpenVSCode Server and code-server under WSL2 against an existing Windows repo (paths, file watching, Git identity, extensions, terminal ownership, speed). It runs in its own session, not the browse session, on an authenticated loopback port, which changes the spec's one-port rule. VS Code handoff stays as the fallback. Mike picks the backend
- [ ] Editor and browser preview side by side, from the ADR's choice
- [ ] Git changes: branch, status and diff for the workspace's repo, read-only first
- [ ] Dev servers the app started: port, URL, ready state, logs, Stop and Restart; never touches a process it didn't start

### 🏃 Milestone D: agent work with evidence

- [ ] Managed runs: a run has an id, its fixed folder and command, start and end, exit code, output and a Cancel; `terminal_run` returns the run id, and `run_status` reads it. Success comes from the exit code, never from the output text
- [ ] Activity drawer: queued, waiting for approval, running, failed, cancelled and finished agent work, each with what was asked and the exact target
- [ ] MCP clients by name: `initialize`'s `clientInfo` recorded and shown, and later a per-client switch for which tools it may call (folds in the Integrations item about `claude` showing as two ✗ rows)
- [ ] Provider adapters: the model API and CLI agents behind one small contract (health, capabilities, invoke, cancel, events), with Claude first
- [ ] Browser actions on a tab the user attaches: screenshot, click and fill by element, with a confirm before anything submits
- [ ] Run history: past runs, their output and changed files, searchable, without scrolling the chat

### Phase 2b: close the agent's loop

Added in the 2026-10-05 review. Today an agent can type a command and open things, but it can't see what happened: `terminal_run` returns before the output, `list_tabs` gives URLs without content, and the "trigger a Cronsole task" the harness promised in [requirements.md](decisions/requirements.md#features) never landed. Each item here is read-only or sits behind the same click as `terminal_run`.

- [x] `list_terminals` and `terminal_read`: the open terminal sessions (id, shell, folder, whether PowerShell, whether exited) and the last N lines of one session's output with ANSI escapes stripped, from a ring buffer the main process keeps per session. Read-only, no click. Closes the loop for "run `npm test` and tell me what failed" — 2026-10-05; `src/shared/output.js` cleans the output (4 tests), the tools have 1 test, and `npm run smoke` reads back what `terminal_run` printed
- [x] `read_tab`: the visible text of a tab (`document.body.innerText`, clipped to a size limit) plus its title and URL, so the chat can summarise or quote the page it's looking at. The tool description says the text is untrusted page content, not instructions — 2026-10-05; 1 test, and `npm run smoke` reads example.com back
- [x] `cron_run`: start a Cronsole task through Cronsole's own `run_task`, shown on the confirm bar like a command and run only after the click; `cron_tasks` as the read-only list the Cron tab already has. The task id stays in the main process; the click only answers yes or no — 2026-10-05; `runTask` in `src/shared/cronsole.js` (2 tests) and the tools (2 tests); `npm run smoke` calls `cron_tasks`
- [x] Chat: a "+ page" and "+ terminal" button that attaches `read_tab` or `terminal_read` output to the next message, so "what does this page say" needs no tool round-trip — 2026-10-11, roadmap run; toggles in the chat bar, read in the main process through the MCP server (logged like any call) and sent as `<attached …>` blocks the system prompt calls content, not instructions. 3 tests; `npm run smoke` toggles + page. Not yet sent to the live API, which needs Mike's key
- [x] Chat: stream the reply as it arrives, trim old turns past a token budget, and keep the last conversation across restarts in `chat.json` — 2026-10-12, roadmap run; `readStream`, `trimHistory` (about 50,000 tokens, whole turns, oldest first), `cleanMessages` and `transcript` in `src/shared/chat.js`, 8 tests; `npm run smoke` checks the panel gets the saved history. Not yet streamed from the live API, which needs Mike's key
- [x] MCP `tools/list` carries `annotations` (`readOnlyHint`, `destructiveHint`, `openWorldHint`) so clients can show which tools look and which act — 2026-10-14, roadmap run; seven tools look, `open_tab` and `open_file` open without harm, `terminal_run` and `cron_run` are destructive and open-world. Set in `src/shared/tools.js`, passed through by `src/shared/mcp.js`; 1 test

### Integrations

APIs the neighbours already expose, found in the 2026-10-05 review.

- [x] Project Hub's `/api/events` stream: the sidebar subscribes once and reloads the tree on `change`, so a rescan shows up without Retry and the document index in `src/main/docs.js` drops its 30 s cache — 2026-10-18; `src/shared/events.js` parses the stream (6 tests), the main process subscribes and reconnects over the stream, a `change` reloads the Files tree and invalidates the doc index, and the demo's fake hub answers the new `onChanged`
- [x] Star the current page: a ☆ in the address bar that adds the tab to Hub's favorites through `PUT /api/favorites`, so the app's own bookmarks source gains entries without opening Hub — 2026-10-18; `src/shared/favorites.js` adds/removes a link in the favorites tree (6 tests), `hub.favorite` GETs and PUTs the whole list, the address-bar ☆ toggles and shows filled when starred, and the demo's fake hub toggles for real
- [x] Links in the terminal open as tabs: an xterm `registerLinkProvider` for `http(s)://` and `localhost:<port>` text, so the address a dev server prints is one click from a tab. No new dependency; mark `- [!]` and use `@xterm/addon-web-links` (MIT) if the hand-written provider misses cases — 2026-10-18, roadmap run; `src/shared/links.js` finds the links (6 tests), `src/renderer/terminal.js` registers the provider and a click opens a tab. A URL wrapped onto a second row links its first row only
- [x] Cronsole rows show the last run's result: `get_task_history` on hover or click, with `get_run_output` behind a "Show output" that opens as an `acc://doc`-style page — 2026-10-19, roadmap run; a click on a task unfolds its last 5 runs, a run opens `acc://run/<task>/<run>` (the run's log, or `get_run_output` for a platform run) under `DOC_HEADERS`, from the app only. `taskHistory`, `runOutput`, `runRows`, `runUrl`/`runFromUrl` and `runSummary` in `src/shared/cronsole.js`, `runPage` in `src/shared/docs.js`, 6 tests; `npm run smoke` opened a real run's page
- [ ] A count of failed Cronsole tasks on the Cron tab's label, refreshed on the same timer as the Hub health dot
- [ ] Claude Code in the terminal: when `claude` registers with the MCP server, the MCP tab's first row says which client connected (`initialize`'s `clientInfo`), so the log reads "claude-code 2.x connected" rather than two ✗ rows

### Later

Moved behind Milestones A to D on 2026-10-20: none of these helps the edit, run and check loop. The IDE line moved to Milestone C.

- [ ] Docs upkeep view, as a filter on the Cron tab (the docs-maintenance jobs and their reports) rather than a panel of its own
- [ ] AI news panel and AI bookmarks feed, read from configurable RSS or Markdown sources
- [ ] Phone channel through an existing gateway (Claude Remote Control, Hermes or OpenClaw). Needs its own ADR first: pairing, per-device scopes and revocation. Never exposes the MCP port as it is

### Daily use, round 2

Nice to have; found in the 2026-10-05 review.

- [x] Right-click in the terminal copies a selection or pastes — 2026-10-20; `src/renderer/terminal.js`
- [x] Manage extensions: an **Extensions** menu with Get extensions…, and per extension Options, Web Store page and Remove (uninstalls for good) — 2026-10-20; `extensionsMenu` in `src/main/extensions.js`
- [x] Ad and tracker blocking, on by default with a menu toggle: Ghostery's engine with EasyList/EasyPrivacy, since Web Store MV3 blockers can't work in Electron — 2026-10-20, Mike's call on the dependency; `src/main/adblock.js`
- [ ] Address bar suggestions from Recent and bookmarks as you type, picked with the arrow keys
- [ ] Tabs: drag to reorder, duplicate, mute, and pin any tab (today only Cronsole's is pinned)
- [ ] Downloads: `will-download` handled so a finished download shows a toast with Reveal in Explorer, and lands in Recent
- [ ] Light theme for the shell, following `prefers-color-scheme` the way document pages already do
- [ ] Terminal search with `@xterm/addon-search` (MIT) — `- [!]` needs a dependency
- [ ] Terminals: rename a tab, font size, and output sent to the renderer in batches so a noisy build doesn't flood IPC
- [ ] Keyboard and screen-reader pass: the Files tree and tab strip work from the keyboard, focus is visible, the confirm bar takes focus, splitters report their value
- [ ] Measure memory per tab with ten tabs open, before deciding whether idle tabs need suspending

### Code health

From the 2026-10-05 review.

- [x] Move the smoke routine out of `src/main/main.js` into `src/main/smoke.js`; it's 150 lines of a 490-line file that CLAUDE.md says should stay thin — 2026-10-20; `main.js` 590 → 389 lines, `npm run smoke` passes unchanged
- [x] Test counts in `README.md`, `tests/README.md` and `CLAUDE.md` drift apart (65+, 74 and 80 on 2026-10-05). Say "80+" once in `tests/README.md` and drop the number elsewhere, or print it from CI — 2026-10-20; the one count is the "140+" badge in `tests/README.md`, CLAUDE.md points there, README.md had none

### Distribution and promotion

- [ ] Windows installer with electron-builder, published as a GitHub release, with a profile backup before an upgrade and a way back
- [ ] 🔒 Code-signing certificate (costs money)
- [ ] Electron upgrade drill done once, following ADR-001's checklist
- [ ] Launch post for the ai-automation-tools.dev landing page

---

<p align="center">
  <a href="README.md">← Docs home</a> ·
  <a href="CHANGELOG.md">Changelog →</a>
</p>
