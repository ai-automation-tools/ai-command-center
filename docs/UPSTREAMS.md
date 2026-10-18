# Upstreams

Every external service, protocol, SDK and platform AI Command Center depends on, what the code
assumes about each, and where to check whether that assumption still holds. The biweekly
**AI-Command-Center Upstream Check** routine (`upstream/auto-*` PRs) works from this file. Keep it
current by hand too: a new outbound call or a new runtime dependency is a new row.

**Last checked** is filled in by the routine, and only with a date it actually read the source.
`—` means never checked.

## Protocols and APIs

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **Anthropic Messages API** *(chat panel)* | `POST https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01` and `stream: true`; the reply is server-sent events that `readStream` puts back into content blocks (`text`, `tool_use`), with `tool_result` blocks sent back. The key comes from `ACC_CHAT_API_KEY` or `ANTHROPIC_API_KEY`, the model from `ACC_CHAT_MODEL` or `ANTHROPIC_MODEL`; there is no default model ID | `src/shared/chat.js`, `src/main/chat.js` | docs.anthropic.com/en/api/versioning; docs.anthropic.com/en/api/messages-streaming; docs.anthropic.com/en/docs/about-claude/models (deprecations) | — |
| **Model Context Protocol** *(the app is an MCP server)* | Hand-written JSON-RPC 2.0 over HTTP on `127.0.0.1` with a per-launch bearer token. `initialize` answers one of the protocol versions `2025-11-25`, `2025-06-18`, `2025-03-26` (echoing the client's if listed); also `ping`, `tools/list` (with `readOnlyHint` / `destructiveHint` / `openWorldHint` annotations) and `tools/call` returning `content` plus `structuredContent` | `src/shared/mcp.js`, `src/main/mcp.js` | modelcontextprotocol.io/specification (latest revision and changelog); github.com/modelcontextprotocol/modelcontextprotocol/releases | — |
| **Cronsole's MCP server** *(stdio child process)* | Started from the path in `ACC_CRONSOLE_MCP` on the app's own Electron binary with `ELECTRON_RUN_AS_NODE=1`; speaks newline-delimited JSON-RPC over stdio; the app calls only `initialize`, `list_tasks` and `run_task` (with an id from that list), and reads `CRONSOLE_TOKEN` / `CRONSOLE_API_URL` from the environment | `src/main/cronsole.js`, `src/shared/cronsole.js` | github.com/ai-automation-tools/cronsole (`mcp-server/`, README, releases) | — |
| **Project Hub HTTP API** *(loopback, default `http://127.0.0.1:4273`)* | `GET /api/health`, `/api/scan`, `/api/webmarks`, `/api/favorites`, `/api/file`, and `/api/open`; sent from the main process with Node's `fetch`, so no `Sec-Fetch-Site` header reaches Hub's same-origin guard. 30 s timeout | `src/main/hub.js`, `src/main/docs.js`, `src/shared/tree.js`, `src/shared/docs.js`, `src/shared/settings.js` | github.com/ai-automation-tools/project-hub (`server` routes, README, releases) | — |
| **Chrome Web Store** | `https://chromewebstore.google.com` is a default quick link; `electron-chrome-web-store` makes its "Add to Chrome" button install into the browse session and runs `updateExtensions` at start | `src/shared/settings.js`, `src/main/extensions.js` | developer.chrome.com/docs/extensions/develop/migrate (Manifest V2 to V3 timeline); github.com/samuelmaddock/electron-browser-shell/releases | — |

## Runtime and platform

| Upstream | What the code assumes | Code | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **Electron** | `^44.7.0`; one `BaseWindow`, a shell `WebContentsView` plus a sandboxed `WebContentsView` per tab; `ELECTRON_RUN_AS_NODE` for Cronsole's server; the main process runs ESM | `src/main/*.js`, `package.json`, `scripts/smoke.js` | releases.electronjs.org/release/stable; electronjs.org/docs/latest/tutorial/electron-timelines (supported majors) | — |
| **Chrome extension support** | `electron-chrome-extensions` `^4.9.0` and `electron-chrome-web-store` `^0.13.0` (GPL-3.0); `adm-zip` is pinned to `^0.6.1` by `overrides` in `package.json` because of a transitive advisory | `src/main/extensions.js`, `package.json` | github.com/samuelmaddock/electron-browser-shell/releases; github.com/advisories (adm-zip) | — |
| **node-pty** | `^1.1.0`; prebuilt N-API binaries and the bundled `conpty.dll` on Windows; `pty.spawn(file, args, …)` with a fixed shell per profile; install scripts allowed only for `node-pty@1.1.0` (`allowScripts`) | `src/main/terminal.js`, `src/shared/shells.js`, `package.json` | github.com/microsoft/node-pty/releases | — |
| **xterm.js** | `@xterm/xterm` `^6.0.0` and `@xterm/addon-fit` `^0.11.0`, loaded by the shell renderer and the demo | `src/renderer/`, `src/demo/`, `package.json` | github.com/xtermjs/xterm.js/releases | — |
| **PowerShell 7** | Terminal profiles launch fixed executables with fixed arguments; Windows is the only target | `src/shared/shells.js` | github.com/PowerShell/PowerShell/releases | — |
| **Node.js** | CI runs Node 24 on `ubuntu-latest` and `windows-latest`; tests use `node:test`, no TypeScript build | `.github/workflows/ci.yml`, `package.json` | nodejs.org/en/about/previous-releases (EOL dates) | — |

## CI and hosting

| Upstream | What the code assumes | Where | Check at | Last checked |
|:---|:---|:---|:---|:---|
| **GitHub Actions** | `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`; Dependabot raises the grouped bumps | `.github/workflows/ci.yml`, `.github/workflows/pages.yml` | github.com/actions/setup-node/releases; github.com/actions/deploy-pages/releases | — |
| **GitHub Pages** | The demo (`npm run demo` into `_site/`) is deployed by `pages.yml` to `https://ai-automation-tools.dev/ai-command-center/` on every push to `main` | `.github/workflows/pages.yml`, `scripts/demo.js` | docs.github.com/en/pages; github.blog/changelog | — |
| **npm audit** | The CI `audit` job runs `npm audit --omit=dev` and must stay green | `.github/workflows/ci.yml` | docs.npmjs.com/cli/commands/npm-audit | — |

Flag breaking majors, EOL runtimes, protocol revisions and security advisories only. Routine bumps
are Dependabot's job. `src/demo/` makes no network calls and has no upstream.
