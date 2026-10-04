// Starts the Control Center MCP server (src/shared/mcp.js) on 127.0.0.1 with a random
// port and a fresh token, and writes both to mcp.json in userData so a local client
// can find them. The file is removed on quit; a stale one fails auth anyway.
// Every call goes to logs/mcp.log in userData and to the sidebar's MCP panel.

import { app } from 'electron';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createMcpServer } from '../shared/mcp.js';
import { logLine, pushEntry } from '../shared/mcplog.js';

const infoFile = () => path.join(app.getPath('userData'), 'mcp.json');
const LOG_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The call log: the newest calls in memory for the panel, every call appended to
 * mcp.log as a JSON line. Past 5 MB the file moves to mcp.log.1, replacing the last one.
 * @param {(channel: string, ...args: unknown[]) => void} send
 */
export function mcpLog(send) {
  const dir = path.join(app.getPath('userData'), 'logs');
  const file = path.join(dir, 'mcp.log');
  /** @type {import('../shared/mcplog.js').LogEntry[]} */
  const entries = [];
  return {
    entries,
    /** @param {import('../shared/mcplog.js').LogEntry} entry */
    add(entry) {
      pushEntry(entries, entry);
      send('mcp:logged', entry);
      try {
        fs.mkdirSync(dir, { recursive: true });
        if ((fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0) > LOG_MAX_BYTES) fs.renameSync(file, `${file}.1`);
        fs.appendFileSync(file, logLine(entry));
      } catch (err) {
        console.error('[mcp] could not write mcp.log:', err);
      }
    },
  };
}

/**
 * @param {Map<string, import('../shared/mcp.js').Tool>} tools
 * @param {(entry: import('../shared/mcplog.js').LogEntry) => void} onCall
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export async function startMcp(tools, onCall) {
  const token = randomBytes(32).toString('hex');
  const server = createMcpServer({ token, tools, version: app.getVersion(), onCall });
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
