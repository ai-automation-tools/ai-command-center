// Starts the Control Center MCP server (src/shared/mcp.js) on 127.0.0.1 with a random
// port and a fresh token, and writes both to mcp.json in userData so a local client
// can find them. The file is removed on quit; a stale one fails auth anyway.

import { app } from 'electron';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createMcpServer } from '../shared/mcp.js';

const infoFile = () => path.join(app.getPath('userData'), 'mcp.json');

/**
 * @param {Map<string, import('../shared/mcp.js').Tool>} tools
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export async function startMcp(tools) {
  const token = randomBytes(32).toString('hex');
  const server = createMcpServer({ token, tools, version: app.getVersion() });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(undefined));
  });
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const url = `http://127.0.0.1:${port}/mcp`;

  const file = infoFile();
  fs.writeFileSync(`${file}.tmp`, JSON.stringify({ url, port, token, pid: process.pid }, null, 2), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);

  return {
    url,
    close() {
      server.close();
      fs.rmSync(file, { force: true });
    },
  };
}
