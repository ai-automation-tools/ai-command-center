// The chat panel's one conversation, held in the main process so the API key never
// reaches the shell UI. The turn logic is in src/shared/chat.js; tools go through the
// app's MCP server, so every call the chat makes is logged like any other client's.

import { chatAttach, chatConfig, chatText, mcpClient, messagesApi, runTurn } from '../shared/chat.js';

/**
 * @param {{ mcp: () => { url: string, token: string } | null, send: (channel: string, ...args: unknown[]) => void }} opts
 */
export function chat({ mcp, send }) {
  // ponytail: the whole conversation goes with every request; Clear starts over. Trim old turns if long chats get slow or costly.
  /** @type {import('../shared/chat.js').Message[]} */
  let messages = [];
  let busy = false;

  return {
    /** What the panel needs to know: the model, or which variables to set. Never the key. */
    info() {
      const { model, missing } = chatConfig(process.env);
      return { model, missing, mcp: Boolean(mcp()) };
    },

    /** @param {unknown} input @param {unknown} [attach] 'page' and/or 'terminal', read through read_tab and terminal_read */
    async send(input, attach) {
      const text = chatText(input);
      const kinds = chatAttach(attach);
      const { apiKey, model, missing } = chatConfig(process.env);
      if (missing.length) throw new Error(`Set ${missing.join(' and ')} in your environment, then restart the app.`);
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
      }
    },

    reset() {
      if (busy) throw new Error('Wait for the answer to the last message.');
      messages = [];
    },
  };
}
