<a id="docs-top"></a>

<h1 align="center">📚 AI Command Center Docs</h1>

<p align="center">
  <em>Why the app is built the way it is, what's left, and what changed.</em>
</p>

<p align="center">
  <a href="ROADMAP.md"><img src="https://img.shields.io/badge/plan-ROADMAP-8B5CF6?style=for-the-badge" alt="Roadmap"></a>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.1.0-2ea44f?style=for-the-badge" alt="Version 0.1.0"></a>
  <a href="../README.md"><img src="https://img.shields.io/badge/↩-repository_root-6B7280?style=for-the-badge" alt="Repository root"></a>
</p>

---

Start with the roadmap if you want to know what to do next, or the decisions folder if you want to know why the app looks like this. The business analysis that argued against building it, and the override that started the build, are kept outside this repo with the original build prompt. [product/](product/README.md) has the spec and build plan the weekly routine works from.

## 🗺️ Planning

| Document | What's inside |
|:---|:---|
| [**🗺️ ROADMAP.md**](ROADMAP.md) | The release gates: Phases 0 to 2 and the daily-use gates are done; the public-release checklist is under way (CI, settings file, SECURITY.md, permissions, crash log, shortcuts, find in page and the README rewrite landed 2026-10-05; the live demo remains). Below `After public release`: LastPass, Mike's daily-use log, Phase 2b (the agent reads terminals, pages and runs Cronsole tasks), integrations over Hub's and Cronsole's APIs, Phase 3, a second daily-use round, and code health. |
| [**📋 CHANGELOG.md**](CHANGELOG.md) | Unreleased: the 2026-10-05 review's eight gates (CI, settings file, SECURITY.md, page permissions, crash log, browser shortcuts, find in page, the README rewrite) and the `list_terminals`, `terminal_read`, `read_tab`, `cron_tasks` and `cron_run` tools; before that, tabs that reopen after a restart, the no-console launcher, the MCP server with its read-only, navigation and `terminal_run` tools, its call log and the Claude Code setup, the chat panel, the Cron tab with Cronsole's pinned tab, the Files right-click menu, documents shown under the app's own sidebar, the shell menu, and fixes for the "Object has been destroyed" popup and the page menu's open-externally item. 0.1.0: the Phase 1 slice, two shutdown and layout fixes, and the extension known issue. |

## ⚖️ Design

| Folder | What's inside |
|:---|:---|
| [**🎯 product/**](product/README.md) | The spec (must stories with acceptance criteria, the Won't list) and the build plan with its stop points. |
| [**⚖️ decisions/**](decisions/README.md) | Requirements, three architecture options, and three ADRs: the Electron shell (with the extension spike), Project Hub over HTTP, and the terminal. |

<p align="right">(<a href="#docs-top">back to top</a>)</p>

---

<p align="center">
  <a href="../README.md">← Repository home</a> ·
  <a href="decisions/README.md">Decisions</a> ·
  <a href="ROADMAP.md">Next: Roadmap →</a>
</p>
