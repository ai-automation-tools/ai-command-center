<h1 align="center">🔒 Security Model</h1>

<p align="center">
  <em>What a web page, an agent and the app's own processes can and can't do.</em>
</p>

<p align="center">
  <a href="../../SECURITY.md"><img src="https://img.shields.io/badge/report-SECURITY.md-e74c3c?style=for-the-badge" alt="Report a vulnerability"></a>
  <a href="README.md"><img src="https://img.shields.io/badge/↩-guide-6B7280?style=for-the-badge" alt="Back to the guide"></a>
</p>

---

The rules every change has to keep are in [CLAUDE.md](../../CLAUDE.md)'s security invariants. To report a problem, see [SECURITY.md](../../SECURITY.md).

## Web pages

- Browser tabs are sandboxed. Their only preloads are the extension-API ones, which act only on `chrome-extension://` pages, and, with ad blocking on, Ghostery's cosmetic-filter preload, which asks the main process for the CSS that hides ad slots.
- Tabs can't navigate to `javascript:`, `data:` or the app's own protocols.
- A page gets no permission it asks for (camera, microphone, location, notifications, MIDI, screen capture, clipboard reads, USB, serial, HID) except fullscreen, pointer lock and sanitized clipboard writes. Without a handler, Electron would grant all of them.
- Every IPC channel checks the sender is the shell UI's main frame.

## Document and run pages

- `acc://doc/…` pages are served to the sandboxed tabs only, run no scripts (`default-src 'none'`), can't be framed, and can't be reached from a web page.
- Only files in Project Hub's index are served, so a crafted address can't read anything else.
- A Cronsole run page (`acc://run/…`) has the same policy, opens only from the sidebar, and shows the run's output as text.
- A Git diff page (`acc://git/…`) does too, and is served only for a file `git status` lists right now with that kind of change.

## Terminals and agents

- Each shell is a fixed executable with fixed arguments. The UI chooses only a starting folder and a shell by name.
- `terminal_run` never starts a process. After you click Run, it types one line into a new PowerShell terminal opened for that command in the folder the bar named.
- The main process keeps the command and folder. The click only says yes, and main checks the terminal it gets back is that fresh one.
- Newlines, control characters and invisible characters are refused, so the bar shows exactly what runs. Unanswered asks expire after 5 minutes.

## The MCP server

- It's the app's only listening port: `127.0.0.1` only, a random port and a fresh token each launch (in `mcp.json`, deleted on quit). A call without the token is refused.
- Every call, answered or refused, is logged to the MCP tab and `logs\mcp.log`: one JSON line each, arguments clipped to 300 characters, rotated at 5 MB.
- `open_file` takes Hub node ids, never paths, and can't open a file with its default app, so an agent can't launch a script that way.
- `read_tab` and `terminal_read` carry whatever is on screen. Their descriptions tell the model it's content, not instructions.
- Project Hub is reached over loopback from the main process.

## Processes and data

- The Git tab runs `git` itself, read-only: fixed command lines through `execFile`, no shell, in the workspace's repo, with the scrubbed environment the terminals get. It runs the `git.exe` found on PATH's absolute entries, never a bare `git`, which Windows would look for in the repo folder first. Every call turns off fsmonitor hooks, external diff tools and textconv drivers. A file path reaches git only after `--`, and only when git just listed it.
- Cronsole's MCP server is the only other process the app starts besides the terminals: the app's own Electron binary running the script `ACC_CRONSOLE_MCP` names, which only `.env` or your environment can set. It talks over stdio and listens on nothing.
- The app calls only Cronsole's read-only `list_tasks`, `get_task_history` and `get_run_output`, plus `run_task` for a task you clicked Run for. The task id never comes from the click, only the yes.
- The chat key goes only to `api.anthropic.com`. It's never sent to the shell UI or written to disk.
- The chat's tool calls go through the MCP server with its token, so they're logged and confirmed like any other agent's.
- Claude's replies and the context tray's attachments are shown as plain text, never HTML.
- Crashes go to `logs\app.log` and extension errors to `logs\extensions.log`, nowhere else. No telemetry.

---

<p align="center">
  <a href="cronsole.md">← Cronsole</a> ·
  <a href="contributing.md">Next: Contributing →</a>
</p>
