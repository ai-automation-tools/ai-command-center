# Security

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository ("Report a
vulnerability" under the Security tab). Don't open a public issue for anything that
could let a web page, an agent or another local process do more than the model below
allows. Expect an acknowledgement within a week.

## What the app promises

The full model, with file references, is in the README's
[Security model](README.md#-security-model) section and in `CLAUDE.md`'s
security invariants, which every change has to keep. In short:

- **Web pages are untrusted.** Browser tabs run sandboxed with context isolation and
  no preload from this app. They can't reach the shell UI's IPC, navigate to
  `javascript:`, `data:` or the app's own `acc://` pages, and every permission
  request (camera, microphone, location, notifications, devices) is denied unless it
  is on a short allowlist.
- **Nothing listens on the network** except the app's own MCP server, bound to
  `127.0.0.1` with a random port and a per-launch token. Calls without the token, or
  with a non-loopback `Host` header, are refused and logged.
- **No shell path or argument crosses a trust boundary.** Terminal shells are fixed
  profiles; the UI picks a folder and a profile id. An agent's `terminal_run` shows
  the command and folder and runs it only after the user clicks Run, in a new
  terminal opened for it; the command never leaves the main process.
- **Secrets stay out of the repo and the renderer.** The chat's API key is read from
  the gitignored `.env` (or the environment) by the main process, kept out of the
  terminals' and Cronsole's environment, and sent only to the model's API. The MCP
  token lives in `%APPDATA%\ai-command-center\mcp.json` with owner-only permissions
  and is deleted on quit.

## Secret scanning

The whole history is scanned with [gitleaks](https://github.com/gitleaks/gitleaks)
before a release:

```powershell
gitleaks git --no-banner --redact .
```

Last run: 2026-10-05, 17 commits, no leaks found. GitHub secret scanning and push
protection are on for the repository as well.

## Supported versions

Only the latest commit on `main` is supported. Electron is bumped at least every
24 weeks so the app keeps Chromium's security fixes; `docs/decisions/adr-001-electron-shell.md`
has the upgrade checklist and the known open advisories.
