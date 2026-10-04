<h1 align="center">🧪 Tests</h1>

<p align="center">
  <em>Unit tests for the shared helpers, plus the two scripts that check the real app.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-60_passing-2ea44f?style=for-the-badge" alt="60 tests passing">
  <img src="https://img.shields.io/badge/runner-node_--test-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="node --test">
  <a href="../README.md"><img src="https://img.shields.io/badge/↩-repository_root-6B7280?style=for-the-badge" alt="Repository root"></a>
</p>

---

The unit tests use Node's built-in runner, so there's nothing to install beyond the app itself. They cover the code with logic in it; the Electron wiring is covered by the smoke run instead, because mocking Electron would test the mock.

| File | What it pins down |
|:---|:---|
| [**tree.test.js**](tree.test.js) | Hub id to path (base, home, virtual), click actions (files open as documents), the right-click menu for folders, files and virtual nodes, terminal folders, a 20,000-deep tree flattening without a stack overflow, search ranking and limits, bookmark flattening. |
| [**url.test.js**](url.test.js) | Address-bar input: URLs kept, Windows paths to `file://`, loopback to `http`, hosts to `https`, everything else to a search; `javascript:` and `data:` refused. |
| [**recent.test.js**](recent.test.js) | Newest first, de-duplicated by type and target, capped at 50, and a hand-edited file can't inject bad entries. |
| [**mcp.test.js**](mcp.test.js) | MCP server: exact-token and loopback-host checks, protocol negotiation, tool listing and calls, JSON-RPC errors, and a real HTTP server refusing a missing or wrong token (401), GET (405) and bad JSON (400). |
| [**tools.test.js**](tools.test.js) | MCP tools through `handleMessage`: `list_tabs`, `sidebar_search` (absolute paths, bookmarks, recent, per-group limits, partial results with an `errors` list when Hub is down) and `recent` (type filter, limit); blank, oversized or non-string queries and out-of-range limits come back as tool errors. `open_tab` (address-bar text to a URL, background tabs; about: and extension pages refused) and `open_file` (VS Code or reveal; absolute paths, `..`, UNC, virtual `@` nodes, control characters and default-app opens refused, Hub errors surfaced). `terminal_run` (trimmed command passed on, terminal reported, denial as a tool error; newlines, tabs, escapes, bidi and zero-width characters refused before anything is asked). Also the shared `searchAll`. |
| [**confirm.test.js**](confirm.test.js) | Confirmations: payload shown with an id, settled once, asks independent, unanswered asks time out to null and tell the UI, late answers ignored. |
| [**docs.test.js**](docs.test.js) | Document pages: URLs mirroring Hub ids so relative links resolve, round-trips with spaces and `#`, refused hosts and virtual ids, `..` collapsed, web pages refused navigation to `acc://doc`, escaping, folder listings, and headers that forbid scripts and framing. |
| [**shells.test.js**](shells.test.js) | Shell profiles: PowerShell 7 first, missing shells skipped, a per-user Git install found, a PATH fallback, unknown ids (including paths and arguments) falling back to the default; and the native-menu item check. |
| [**session.test.js**](session.test.js) | Saved tabs: only allowed schemes, no blank pages, order kept, capped at 30; a bad active index falls back to the last tab. |

## Checking the real app

| Command | What it does | Takes |
|:---|:---|:---|
| `npm run smoke` | Launches the app, opens example.com and a terminal, expands the first folder, searches "README", logs the counts, calls the MCP server without and with the token from `mcp.json` (expects 401 then 200) opens a background tab with `open_tab` and logs what `list_tabs`, `sidebar_search` and `recent` return, calls `terminal_run` and clicks Run on the confirm bar, lists the shells, starts and kills a Command Prompt session, clicks a Markdown file, checks the document page it lands on (title, headings, images, no second sidebar) and saves `doc.png`, saves `shell.png` and `tab.png` to `.smoke/`, and quits. Fails with a timeout if the app doesn't exit. | 30 to 80 s |
| `npm run spike:extensions` | Installs LastPass and Rakuten from the Web Store, loads a shop page, and logs each extension's errors. Rerun on every Electron upgrade. | about 60 s |

> [!NOTE]
> Both commands open a real window and use the real profile in `%APPDATA%\ai-command-center`, so extensions they install stay installed. They don't restore or save the open tabs, so your saved tabs survive a smoke run.

---

<p align="center">
  <a href="../README.md">← Repository home</a> ·
  <a href="../src/README.md">← Source</a>
</p>
