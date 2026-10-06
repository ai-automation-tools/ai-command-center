<h1 align="center">🧱 Build Plan</h1>

<p align="center">
  <em>The slices, in risk order, and the point where we'd stop.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/now-slices_3_and_2b-F59E0B?style=for-the-badge" alt="Now: slices 3 and 2b">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-product-6B7280?style=for-the-badge" alt="Back to product"></a>
</p>

---

Each slice runs from the UI through to the main process and is usable when it lands. The checkable items for each are in [ROADMAP.md](../ROADMAP.md); this page is the order and the reasoning.

| # | Slice | Risk it retires | State |
|:-:|:---|:---|:---|
| 0 | **Decide.** Requirements, three architecture options, three ADRs. | Picking a runtime that can't carry the product | ✅ 2026-09-29 |
| 1 | **One window.** Tabs, terminal, Hub sidebar, recent, search, extension spike. | Whether Electron can host a daily browser and a real terminal on this machine. Answer: yes, except MV3 extension workers. | ✅ 2026-09-30 |
| 2 | **Harness.** MCP server on loopback with a token, a command log, confirmations, then the chat panel, then Cronsole. | Whether an agent can drive the window safely. The MCP server comes before the chat panel because it's the part other agents (Claude Code in the terminal) can use on day one. | done 2026-10-04: MCP server with read-only, navigation and `terminal_run` tools, the call log, the `claude mcp add` README section, the chat panel, and Cronsole's tasks in the sidebar with its UI in a pinned tab |
| 3 | **Public release.** CI, a browser demo of the shell with fabricated data, configurable Hub URL and quick links, SECURITY.md, secret scan, licence; from the 2026-10-05 review, page permissions denied by default, a crash log, and the browser shortcuts and find bar a daily browser needs. | Whether a stranger can install it and trust it | started 2026-10-05: CI, settings file, SECURITY.md, permissions, crash log, shortcuts |
| 2b | **Close the agent's loop.** `terminal_read`, `read_tab`, `cron_run`, chat context buttons and streaming. | Whether the harness is useful rather than demonstrable: an agent that can act but not see stops after one step. Runs alongside slice 3 because its read-only tools are small and the chat panel is the first thing a stranger will try. | started 2026-10-05: `list_terminals`, `terminal_read`, `read_tab` |
| 4 | **The rest.** Integrations over Hub's event stream and favorites and Cronsole's run history, then the IDE pane, docs view, news and bookmark feeds, phone channel. | None that blocks release; these are the "should" and "later" rows | after public release |

## When we'd stop

- **After slice 1,** if Mike uses the app as his main window on fewer than 3 of his first 5 working days, or keeps Chrome open for LastPass all day. The composed setup from the business analysis is still in place to fall back to.
- **During slice 2,** if it passes 100 hours. At that point the build is tracking the 450-hour estimate the analysis warned about, and it should be reassessed before going on.

---

<p align="center">
  <a href="spec.md">← Spec</a> ·
  <a href="../ROADMAP.md">Roadmap →</a>
</p>
