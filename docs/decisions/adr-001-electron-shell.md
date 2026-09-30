<h1 align="center">🧱 ADR-001: Electron Shell</h1>

<p align="center">
  <em>One Electron window, browser tabs as views, Chrome extensions through electron-chrome-extensions.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-accepted-2ea44f?style=for-the-badge" alt="Status: accepted">
  <img src="https://img.shields.io/badge/door-one--way--ish-F59E0B?style=for-the-badge" alt="One-way-ish door">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-decisions-6B7280?style=for-the-badge" alt="Back to decisions"></a>
</p>

---

**Date:** 2026-09-29 · **Options weighed:** [architecture-options.md](architecture-options.md)

## Decision

Build the app on **Electron 44** as a single `BaseWindow`:

- The shell UI (sidebar, tab strip, address bar, terminal panel) is one `WebContentsView` loading local files over a private `acc://shell/` protocol.
- Each browser tab is its own `WebContentsView` in the `persist:browse` session, stacked over the shell's content area. The shell reports that rectangle to the main process whenever it changes.
- **electron-chrome-extensions 4.9** supplies the `chrome.*` APIs and the `<browser-action-list>` toolbar; **electron-chrome-web-store 0.13** makes the Web Store's install button work and keeps installed extensions updated.
- Plain JavaScript ES modules with JSDoc types, no bundler. The preload is CommonJS because it has to `require()` the browser-action helper.

## Why this is one-way-ish

The runtime is the costly thing to change. Moving off Electron later means rewriting the tab and extension layer; the sidebar, terminal renderer, Hub client and shared helpers would carry over. The licence is the other thing that sticks (below).

## Consequences

- **Upkeep.** Electron ships a major every 8 weeks and supports three, so the app has to take a new Electron at least every 24 weeks to keep security fixes. Budget one short session per major: bump, run `npm test`, `npm run smoke`, `npm run spike:extensions`.
- **Licence.** electron-chrome-extensions is dual-licensed GPL-3.0 or a paid patron licence, and the app passes `license: 'GPL-3.0'`. **Decided 2026-09-29: the repo is GPL-3.0-or-later** (`LICENSE`, `package.json`). Every other runtime dependency is MIT or BSD-3-Clause, both GPL-compatible. The cost: forks and anything distributed from this code stay GPL, and a closed-source build would need the patron licence.
- **Known vulnerability.** `npm audit` reports two high-severity advisories in `adm-zip`, used by electron-chrome-web-store to unpack extensions. There's no fixed version. The zips come from Google's Web Store over HTTPS, which limits the exposure; recheck on every dependency bump.
- **The shell's preload isn't sandboxed.** It needs `require()` for `<browser-action-list>`, which a sandboxed preload can't do. The shell loads only this repo's files, never a remote page, and navigation away from it is blocked. Browser tabs stay fully sandboxed with no preload from this app.

## Spike result, 2026-09-29

The prompt makes LastPass and Rakuten a hard gate, so Phase 1 opened with a spike: `npm run spike:extensions` installs both from the Web Store and loads a shop page.

| Check | Result |
|:---|:---|
| Install from the Web Store | ✅ Both install. LastPass 4.156.0 and Rakuten 26.18.2, both Manifest V3. |
| Toolbar buttons | ✅ Both icons show in `<browser-action-list>`. |
| Background service worker | ❌ Both crash on start: `Cannot read properties of undefined (reading 'onFocusChanged')`. LastPass then logs "Service worker registration failed". |
| Unknown permissions | ⚠️ Electron doesn't recognise `webNavigation`, `cookies`, `notifications`, `contextMenus`, `privacy`. |

**Why the workers crash.** Both background scripts read `chrome.windows.onFocusChanged` at start. electron-chrome-extensions adds `chrome.windows` through a preload it registers for service workers, and a probe showed that Electron runs session preloads in ordinary service workers but **not in extension service workers**. The library's own roadmap lists "Manifest V3 support — pending electron/electron#44411" for this reason.

**What that means today:** extensions whose MV3 background script uses `chrome.windows` or `chrome.tabs` events don't work. Content-script-only extensions may. LastPass and Rakuten don't.

**The workaround shipped in Phase 1:** the ↗ button in the address bar opens the current page in the default browser, so a login or a Rakuten-eligible shop is one click from Chrome.

**What reopens this ADR:**

- An Electron release that runs preloads in extension service workers, or a library release that drops the MV3 "pending" note. Rerun `npm run spike:extensions` on every Electron major.
- Mike opening Chrome for LastPass on most days during Phase 2. Then evaluate driving an external Chrome from the browser pane, or [option B](architecture-options.md).

---

<p align="center">
  <a href="architecture-options.md">← Architecture options</a> ·
  <a href="adr-002-hub-over-http.md">Next: ADR-002 →</a>
</p>
