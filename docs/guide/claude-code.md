<h1 align="center">🤖 Drive the App from Claude Code</h1>

<p align="center">
  <em>The app's MCP server: how to connect Claude Code, and what each tool does.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tools-11-8B5CF6?style=for-the-badge" alt="11 tools">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-guide-6B7280?style=for-the-badge" alt="Back to the guide"></a>
</p>

---

## Connect once

Every terminal the app opens has `ACC_MCP_URL` and `ACC_MCP_TOKEN` set to this launch's address and token. Register the server with the variable names, not their values, so it survives the new port and token each restart brings:

```powershell
claude mcp add --scope user --transport http ai-command-center '${ACC_MCP_URL}' --header 'Authorization: Bearer ${ACC_MCP_TOKEN}'
```

- The single quotes matter. They stop PowerShell expanding the variables, so Claude Code stores the names and fills them in each time it starts.
- Then run `claude` in one of the app's terminals and ask it to, say, "open this repo's README in a tab" or "run npm test". `/mcp` shows the connection.
- `--scope user` makes the server available in every folder. Claude Code started outside the app has no variables, so it lists `ai-command-center` as failed with "Missing environment variables". That's harmless.

To use it from a terminal outside the app while the app runs, load the variables from `mcp.json` first:

```powershell
$m = Get-Content "$env:APPDATA\ai-command-center\mcp.json" | ConvertFrom-Json
$env:ACC_MCP_URL = $m.url; $env:ACC_MCP_TOKEN = $m.token
```

## The tools

| Tool | Does | Click? |
|:---|:---|:--:|
| `list_tabs` · `read_tab` | The open tabs; one tab's title, URL and visible text, marked as page content, not instructions | no |
| `list_terminals` · `terminal_read` | The open terminals; the last lines one printed, escapes stripped | no |
| `sidebar_search` · `recent` | The sidebar's search across files, bookmarks and Recent; the Recent list | no |
| `open_tab` | Opens what the address bar takes, web pages only. An agent can't open a local file as a tab | no |
| `open_file` | A Hub node id from `sidebar_search`, opened in VS Code or revealed in Explorer. Never a path, never the file's default app | no |
| `terminal_run` | Shows a command and its folder on the Run bar over the terminal. Run opens a new PowerShell terminal there and types it in | **yes** |
| `cron_tasks` · `cron_run` | Cronsole's scheduled tasks; start one now | `cron_run` |

- `tools/list` marks each tool read-only, or destructive for `terminal_run` and `cron_run`, so a client can show which tools look and which act.
- After `terminal_run`, the agent reads the result with `terminal_read`.
- Unanswered Run asks expire after 5 minutes.

## The MCP tab and the log

- Every call, refused ones included, shows in the sidebar's **MCP** tab and is appended to `logs\mcp.log`.
- The log keeps `terminal_run`'s command as its length only and cuts URL query strings.
- Each time Claude Code connects you'll see two ✗ rows: `server/discover`, a method this server doesn't offer, and a `405` for the event stream it doesn't serve. Both are expected.

## Matching skills

[agent-skills](https://github.com/ai-automation-tools/agent-skills) has Claude Code skills for two of the app's integrations: [`project-hub`](https://github.com/ai-automation-tools/agent-skills/tree/main/Skills/Projects/project-hub) for the Hub behind the sidebar, and [`cronsole`](https://github.com/ai-automation-tools/agent-skills/tree/main/Skills/Projects/cronsole) for the tasks behind the Cron tab. Install them where Claude Code in your terminals can see them.

---

<p align="center">
  <a href="features.md">← Features</a> ·
  <a href="chat.md">Next: Chat →</a>
</p>
