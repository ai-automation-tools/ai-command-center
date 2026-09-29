<h1 align="center">🏗️ Architecture Options</h1>

<p align="center">
  <em>Three ways to build the app, what each costs, and why the Electron shell won.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/phase-0-8B5CF6?style=for-the-badge" alt="Phase 0">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-decisions-6B7280?style=for-the-badge" alt="Back to decisions"></a>
</p>

---

Hours are Mike's supervising time with an agent doing the typing. They're judgment calls anchored on the business analysis (450 hours for the whole app; kept local in `Repos/Private/Draft/AI-Command-Center/Analysis/`) and on Cronsole, which took about four months to reach 0.9.0. Treat them as ranges, not quotes.

## The options

| | A. Electron shell | B. BrowserOS fork | C. VS Code as the shell |
|:---|:---|:---|:---|
| **What it is** | One Electron window: our sidebar and terminal, browser tabs as `WebContentsView`s, Chrome extensions through electron-chrome-extensions | Fork BrowserOS (a Chromium browser) and add a sidebar, terminal and harness as browser UI | VS Code with an extension that adds the sidebar and harness; the browser is VS Code's integrated browser or Chrome alongside |
| **Extensions** | Partial. A subset of `chrome.*` APIs; MV3 service workers don't get the API shim yet (spiked, fails) | Full. It's Chromium | Chrome alongside: full. VS Code's browser: none |
| **IDE** | code-server in a pane (Phase 3) | code-server in a tab | Native |
| **Terminal** | xterm.js + node-pty, ours | ttyd or a custom tab | Native |
| **Build to Phase 1** | ~60 to 120 h | ~200 to 400 h: a Chromium build takes hours per compile and a large disk | ~40 to 80 h |
| **Upkeep** | A new Electron major every 8 weeks, three supported | A Chromium rebase every 2 to 3 months, on a pre-1.0 fork running two majors behind Chrome | Low: VS Code updates itself |
| **One window?** | Yes, except sites that need LastPass today | Yes | No: VS Code and a browser |
| **Licence** | GPL-3.0 through electron-chrome-extensions | AGPL-3.0 | MIT (Code-OSS) |

## The call: A, the Electron shell

**Option B has the right browser and the wrong everything else.** It's the only option where LastPass works out of the box, but it means maintaining a Chromium fork alone: multi-hour compiles, a rebase every few months, and a base that already trails Chrome stable by two majors. That's the upkeep the analysis warned about, several times over.

**Option C is the cheapest and isn't one window.** It's close to what the analysis recommended instead of building, and Mike chose to build.

**Option A is the only one that delivers the single window at a cost one person can carry**, and its weak point is known and specific: MV3 extension service workers. The Phase 1 spike confirmed it fails today ([ADR-001](adr-001-electron-shell.md#spike-result-2026-09-29)). Everything else in Option A works on this machine as of 2026-09-29.

What would change the call: if Electron doesn't ship service-worker preloads for extensions by the time Phase 2 is done, and Mike finds he keeps Chrome open for LastPass every day, revisit B, or adopt a hybrid where the browser pane drives an external Chrome.

---

<p align="center">
  <a href="requirements.md">← Requirements</a> ·
  <a href="adr-001-electron-shell.md">Next: ADR-001 →</a>
</p>
