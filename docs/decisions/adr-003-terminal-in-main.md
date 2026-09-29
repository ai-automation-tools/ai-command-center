<h1 align="center">💻 ADR-003: Terminal in the Main Process</h1>

<p align="center">
  <em>node-pty runs PowerShell in the main process; the renderer can choose a folder and nothing else.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-accepted-2ea44f?style=for-the-badge" alt="Status: accepted">
  <img src="https://img.shields.io/badge/door-two--way-2ea44f?style=for-the-badge" alt="Two-way door">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-decisions-6B7280?style=for-the-badge" alt="Back to decisions"></a>
</p>

---

**Date:** 2026-09-29

## Decision

- **node-pty 1.1.0** spawns `C:\Program Files\PowerShell\7\pwsh.exe -NoLogo` (falling back to `pwsh.exe`, then Windows PowerShell) in the main process, through ConPTY using the **bundled `conpty.dll`** (`useConptyDll: true`).
- **xterm.js 6** renders it in the shell, with the fit addon for resizing.
- The renderer can ask for a new terminal with a **starting folder**. The executable and its arguments are fixed in `src/main/terminal.js`. A folder that doesn't exist falls back to the home folder.

## Why

- **No page can start a shell with chosen arguments.** Browser tabs have no IPC access, and even the shell can only pick a folder. This carries over the rule from the Project Control Center's ADR-004, written after looking at how ttyd's URL arguments could be abused.
- **No native build step.** node-pty 1.1.0 ships N-API prebuilds that load in Electron 44 without `electron-rebuild` (verified on this machine). That removes the Visual Studio toolchain from setup.
- **The bundled ConPTY avoids two bugs found in testing.** With Windows' own ConPTY, killing a session forks node-pty's console-list helper, which crashed with `AttachConsole failed` during app shutdown and left the app running. The bundled `conpty.dll` path kills without the helper.

## Consequences

- **The app calls `app.exit(0)` on quit.** Even with the bundled ConPTY, node-pty's output reader thread outlives its session and the process never exits on its own. By the `quit` event every window is closed and every session killed, so exiting explicitly is safe. Found by `npm run smoke` timing out.
- **Keyboard ownership.** PowerShell uses Ctrl+L (clear) and Ctrl+R (history search), so the app menu doesn't take them. Browser tabs map Ctrl+L and Ctrl+R themselves; the address bar also answers to Alt+D. Ctrl+C copies when text is selected and interrupts otherwise; Ctrl+V pastes.
- **Two-way door.** Swapping the renderer or the pty library touches `src/main/terminal.js` and `src/renderer/terminal.js` only.

---

<p align="center">
  <a href="adr-002-hub-over-http.md">← ADR-002</a> ·
  <a href="README.md">Decisions →</a>
</p>
