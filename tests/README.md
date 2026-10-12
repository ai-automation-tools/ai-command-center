<h1 align="center">🧪 Tests</h1>

<p align="center">
  <em>Unit tests for the shared helpers, plus the two scripts that check the real app.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-108_passing-2ea44f?style=for-the-badge" alt="108 tests passing">
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
| [**tools.test.js**](tools.test.js) | MCP tools through `handleMessage`: `list_tabs`, `read_tab` (the active tab or a named one, clipped with a `truncated` flag, bad ids and sizes refused), `list_terminals`, `terminal_read` (the showing terminal or a named one, escapes stripped, last N lines, nothing open), `cron_tasks` (the list, a missing setup as a tool error) and `cron_run` (the id trimmed and passed on, the result returned, denial and unknown ids as tool errors, bad ids refused before asking), `sidebar_search` (absolute paths, bookmarks, recent, per-group limits, partial results with an `errors` list when Hub is down) and `recent` (type filter, limit); blank, oversized or non-string queries and out-of-range limits come back as tool errors. `open_tab` (address-bar text to a URL, background tabs; about: and extension pages refused) and `open_file` (VS Code or reveal; absolute paths, `..`, UNC, virtual `@` nodes, control characters and default-app opens refused, Hub errors surfaced). `terminal_run` (trimmed command passed on, terminal reported, denial as a tool error; newlines, tabs, escapes, bidi and zero-width characters refused before anything is asked). Also the shared `searchAll`. |
| [**chat.test.js**](chat.test.js) | The chat: key and model from the environment with no default model, blank and oversized messages refused, MCP tools and results translated to and from the Messages API, roles kept alternating after a turn that stopped early, attachments (page and terminal only, read through `read_tab` and `terminal_read` before the post, a failed read noted rather than dropped), the tool loop (tool errors and thrown tools passed to Claude, every `tool_use` answered, the 10-round cap), API errors surfaced, and a turn driving a real MCP server over HTTP with its token (calls logged, a denial returned as an error, a wrong token refused). |
| [**confirm.test.js**](confirm.test.js) | Confirmations: payload shown with an id, settled once, asks independent, unanswered asks time out to null and tell the UI, late answers ignored. |
| [**docs.test.js**](docs.test.js) | Document pages: URLs mirroring Hub ids so relative links resolve, round-trips with spaces and `#`, refused hosts and virtual ids, `..` collapsed, web pages refused navigation to `acc://doc`, escaping, folder listings, and headers that forbid scripts and framing. |
| [**shells.test.js**](shells.test.js) | Shell profiles: PowerShell 7 first, missing shells skipped, a per-user Git install found, a PATH fallback, unknown ids (including paths and arguments) falling back to the default; and the native-menu item check. |
| [**mcplog.test.js**](mcplog.test.js) | The MCP call log: tool calls, tool and JSON-RPC errors, junk messages, clipped arguments, refusals, the file line, the capped list, and a real server reporting a refused call, a tool call and a notification through `onCall`. |
| [**cronsole.test.js**](cronsole.test.js) | Cronsole: the server path and UI origin from the environment (non-http UIs refused), the pinned-tab URL match by exact origin, the handshake, `list_tasks` and `run_task` (the id passed on, a result or its text returned, a tool error thrown, ids checked) against a fake stdio server that answers in split chunks with stray lines mixed in, JSON-RPC errors, timeouts and a dying process, tool errors and malformed rows, and the sidebar's next-run, paused, missing and failed rows. |
| [**session.test.js**](session.test.js) | Saved tabs: only allowed schemes, no blank pages, order kept, capped at 30; a bad active index falls back to the last tab. Tab cycling wraps round the strip, and Ctrl+1 to Ctrl+9 follow Chrome's rule. |
| [**settings.test.js**](settings.test.js) | `settings.json`: neutral defaults for a missing or broken file, the Hub URL http(s) only with `ACC_HUB_URL` winning, quick links validated and capped, the default link following the Hub URL. |
| [**permissions.test.js**](permissions.test.js) | Pages get fullscreen, pointer lock and sanitized clipboard writes; media, location, notifications, MIDI, screen capture, clipboard reads, devices and anything unknown are refused. |
| [**demo.test.js**](demo.test.js) | The browser demo: the source bar and the mock load before `app.js`, every path relative, a moved anchor fails the build; renderer imports are relative; the mock answers every call the preload exposes, so a new IPC call can't ship without one; no `fetch`, XHR, WebSocket or beacon in the demo; the fake terminal's echo, prompt and canned output; tab history and reopen; the confirm-bar ask logged as denied without a click. |
| [**output.test.js**](output.test.js) | Terminal output cleaning: colours, titles and hyperlinks stripped, carriage returns and PSReadLine's redraws (absolute column, erase line, cursor back) resolved to what the screen shows, control characters dropped, tabs kept, the last N lines without trailing blanks, the capped buffer. |

## Checking the real app

| Command | What it does | Takes |
|:---|:---|:---|
| `npm run smoke` | Launches the app, opens example.com and a terminal, expands the first folder, searches "README", logs the counts, calls the MCP server without and with the token from `mcp.json` (expects 401 then 200) opens a background tab with `open_tab` and logs what `list_tabs`, `sidebar_search` and `recent` return, calls `terminal_run` and clicks Run on the confirm bar (the command prints `ACC_MCP_URL`, so `shell.png` shows the terminal got it), then reads that output back with `list_terminals` and `terminal_read` and the example.com page with `read_tab`, calls `cron_tasks` (the list, or the setup note when `ACC_CRONSOLE_MCP` isn't set), types a word into the find bar and reads the match count, lists the shells, starts and kills a Command Prompt session, clicks a Markdown file, checks the document page it lands on (title, headings, images, no second sidebar) and saves `doc.png`, checks the MCP panel lists the same calls as the end of `mcp.log`, opens the Chat tab, toggles + page on and off, and logs what it tells the user (model or missing variables, never the key), opens the Cron tab and logs how many Cronsole tasks it lists (or what it says when `ACC_CRONSOLE_MCP` isn't set), clicks Open Cronsole twice and checks there's one pinned tab and it's first, saves `shell.png` and `tab.png` to `.smoke/`, and quits. Fails with a timeout if the app doesn't exit. | 30 to 80 s |
| `npm run spike:extensions` | Installs LastPass and Rakuten from the Web Store, loads a shop page, and logs each extension's errors. Rerun on every Electron upgrade. | about 60 s |
| `npm run demo` | Builds the browser demo into `_site/`. Preview it with any static server (`python -m http.server -d _site`) and check the sidebar, a terminal (`npm test`), and the confirm bar after six seconds. | a second |

> [!NOTE]
> Both commands open a real window and use the real profile in `%APPDATA%\ai-command-center`, so extensions they install stay installed. They don't restore or save the open tabs, so your saved tabs survive a smoke run.

---

<p align="center">
  <a href="../README.md">← Repository home</a> ·
  <a href="../src/README.md">← Source</a>
</p>
