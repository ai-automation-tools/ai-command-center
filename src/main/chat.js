// The chat panel's one conversation, held in the main process so the API key never
// reaches the shell UI. The turn logic is in src/shared/chat.js; tools go through the
// app's MCP server, so every call the chat makes is logged like any other client's.
// The conversation is saved to chat.json after every turn and read back at start.

import { chatAttach, chatConfig, chatText, mcpClient, messagesApi, runTurn, transcript } from '../shared/chat.js';
import { env } from './env.js';

/**
 * @typedef {import('../shared/chat.js').Message} Message
 * @param {{
 *   mcp: () => { url: string, token: string } | null,
 *   send: (channel: string, ...args: unknown[]) => void,
 *   load: () => Message[],
 *   save: (messages: Message[]) => void,
 * }} opts
 */
export function chat({ mcp, send, load, save }) {
  /** @type {Message[]} */
  let messages = load();
  let busy = false;

  /** Saving is best-effort: a full disk shouldn't turn an answered message into an error. */
  const persist = () => {
    try {
      save(messages);
    } catch (err) {
      console.error('[chat] could not save chat.json:', err);
    }
  };

  return {
    /** What the panel needs to know: the model, or which variables to set, and the saved conversation. Never the key. */
    info() {
      const { model, missing } = chatConfig(env);
      return { model, missing, mcp: Boolean(mcp()), history: transcript(messages) };
    },

    /** @param {unknown} input @param {unknown} [attach] 'page' and/or 'terminal', read through read_tab and terminal_read */
    async send(input, attach) {
      const text = chatText(input);
      const kinds = chatAttach(attach);
      const { apiKey, model, missing } = chatConfig(env);
      if (missing.length) throw new Error(`Set ${missing.join(' and ')} in .env, then restart the app.`);
      const server = mcp();
      if (!server) throw new Error("The app's MCP server isn't running, so the chat has no tools.");
      if (busy) throw new Error('Wait for the answer to the last message.');
      busy = true;
      try {
        const client = mcpClient(server.url, server.token);
        await runTurn({
          messages,
          text,
          attach: kinds,
          model,
          tools: await client.list(),
          post: messagesApi(apiKey),
          callTool: (name, args) => client.call(name, args),
          onEvent: (e) => send('chat:event', e),
        });
      } finally {
        busy = false;
        persist();
      }
    },

    reset() {
      if (busy) throw new Error('Wait for the answer to the last message.');
      messages = [];
      persist();
    },
  };
}
