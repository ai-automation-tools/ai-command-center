<h1 align="center">🔗 ADR-002: Project Hub over HTTP</h1>

<p align="center">
  <em>The sidebar reads Project Hub's API from the main process instead of scanning disk itself.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-accepted-2ea44f?style=for-the-badge" alt="Status: accepted">
  <img src="https://img.shields.io/badge/door-two--way-2ea44f?style=for-the-badge" alt="Two-way door">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-decisions-6B7280?style=for-the-badge" alt="Back to decisions"></a>
</p>

---

**Date:** 2026-09-29

## Decision

The Files and Bookmarks panels come from the running Project Hub at `http://127.0.0.1:4273` (override with `ACC_HUB_URL`). The main process calls it with Node's `fetch`; the shell renderer only sees the results over IPC.

| Endpoint | Used for |
|:---|:---|
| `GET /api/health` | The status dot in the sidebar header, checked every minute |
| `GET /api/scan` | The Files tree and the file half of search. About 35k nodes across every workspace. |
| `GET /api/webmarks?source=` | Bookmarks read from Chrome, Edge and Brave profiles on disk |
| `GET /api/favorites` | Hub's own favorites |
| `GET /api/open?path=&in=code` / `&reveal=1` | Open in VS Code, reveal in Explorer |

## Why

- **Hub already does the hard part.** It scans every workspace, reads the browser bookmark files, knows repo state and routine metadata, and has a watchdog task keeping it alive. Rebuilding that in the app would fork it; the Hub README records what three copies of one program cost the last time.
- **It works from the main process with no Hub change.** Hub refuses cross-site browser requests to `/api/open` and the bookmark endpoints by checking `Sec-Fetch-Site`. Node's `fetch` sends no such header, the same as curl, so Hub treats it as a local tool. Calling from the renderer would have needed a Hub change.
- **Two-way door.** If Hub is ever retired, the four calls in `src/main/hub.js` are the whole surface to replace.

## Consequences

- **Hub has to be running.** When it isn't, the Files panel says so and offers Retry; Bookmarks shows the error. Terminals, tabs and Recent keep working.
- **A cold scan takes about 12 seconds.** The first load after Hub restarts shows a loading note. Later loads come from Hub's cache.
- **Bookmarks are read-only in Phase 1.** Hub reads browser bookmark files; it doesn't write them. Hub favorites can be written (`PUT /api/favorites`), which is a Phase 2 option for "star this page".
- **Node ids, not paths, cross the boundary to `/api/open`.** Hub resolves them against its own roots and refuses anything outside, so the app never hands Hub an arbitrary path to launch.

---

<p align="center">
  <a href="adr-001-electron-shell.md">← ADR-001</a> ·
  <a href="adr-003-terminal-in-main.md">Next: ADR-003 →</a>
</p>
