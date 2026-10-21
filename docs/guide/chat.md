<h1 align="center">💬 Chat in the App</h1>

<p align="center">
  <em>Claude in a pane on the right, with the same tools Claude Code gets.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/key-.env_only-2ea44f?style=for-the-badge" alt="Key in .env only">
  <a href="README.md"><img src="https://img.shields.io/badge/↩-guide-6B7280?style=for-the-badge" alt="Back to the guide"></a>
</p>

---

## Set it up

Copy `.env.example` to `.env` in the clone (it's gitignored), fill in the key and model, then restart the app:

```ini
ACC_CHAT_API_KEY=<your Anthropic API key>
ACC_CHAT_MODEL=<a Claude model ID>
```

- A variable set in the real environment wins over the file.
- `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` work too. `ACC_CHAT_API_KEY` is better: with `ANTHROPIC_API_KEY` set, `claude` bills that key instead of your subscription.
- There's no default model, so the app never picks what you pay for.

## Where the key goes

- The main process reads `.env`. It never goes into `process.env`.
- Terminals and Cronsole's server start without `ACC_CHAT_API_KEY` and `ANTHROPIC_API_KEY`, even when those are set in the real environment. A CLI in the app's terminals that needs an API key gets it from its own config or a variable set in that session.
- The key goes only to `api.anthropic.com`. The panel sees the model name, never the key.

## Using it

| Do | What happens |
|:---|:---|
| **💬** in the address bar, or **Ctrl+Shift+L** | Shows or hides the chat pane; × in the pane hides it too |
| Drag the pane's left edge | Resizes it; the width and whether it's open are remembered |
| **Enter** / **Shift+Enter** | Send / new line |
| **+ page** / **+ terminal** | Reads the active tab's text or the showing terminal's last lines into the context tray |
| **✕** on a tray row | Drops that attachment |
| **Show what's sent** | The exact text that will go with the message |
| **Stop** | Ends the answer, cancels a tool call in flight, withdraws a Run prompt it's waiting on |
| **New** | Starts a new conversation; the one you were in stays in the list |
| The name at the top | Opens this workspace's conversations, with a search box |

## The context tray

- + page and + terminal read through `read_tab` and `terminal_read`, the way Claude would, so "what does this page say" needs no tool round-trip.
- Each row says what it is, where it came from and how big it is. A line under the rows says where it goes: the model at `api.anthropic.com`.
- The tray is a snapshot. The message sends what it shows, not a fresh read. Pressing + page again replaces the page.
- Sending, switching conversation and switching workspace empty the tray.

## Answers and tools

- Replies stream in as they're written.
- Each tool call shows in the conversation as it happens, and in the MCP tab like any other client's.
- `terminal_run` still waits for your click on the Run bar. A denial goes back to Claude as an error.
- Stop never undoes a command that already started; it keeps running in its terminal.
- A model request gives up after 5 minutes, a tool call after 6.

## Conversations

- Each workspace keeps its own list. A conversation is listed after its first message and named after it.
- Click the name at the top of the chat pane for the list. Click a row to open it, ✎ to rename it, ✕ twice to delete it.
- The search box matches every word you type against names and message text, and shows where it matched. Attached page and terminal text isn't searched.
- Saved after every message, attached text included, and back after a restart.
- Stored under `%APPDATA%\ai-command-center\chats\<workspace>\`: `index.json` for the list, one file per conversation. An older `chat.json` or `chat-<workspace>.json` moves in as the first conversation.
- Past about 50,000 tokens (estimated at four characters a token), the oldest whole turns are dropped before the next request. The panel says how many went.

---

<p align="center">
  <a href="claude-code.md">← Claude Code</a> ·
  <a href="cronsole.md">Next: Cronsole →</a>
</p>
