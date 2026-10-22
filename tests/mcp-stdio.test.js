import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { createMcpServer } from '../src/shared/mcp.js';

const TOKEN = 'b'.repeat(64);
const tools = new Map([['echo', { description: 'Echo', inputSchema: { type: 'object' }, run: (/** @type {any} */ a) => a }]]);

test('mcp-stdio bridges stdin lines to the app and says so when it is not running', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'houston-stdio-'));
  const file = path.join(dir, 'mcp.json');
  const server = createMcpServer({ token: TOKEN, tools, version: '0.0.0' });
  await new Promise((r) => server.listen(0, '127.0.0.1', () => r(undefined)));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const child = spawn(process.execPath, ['scripts/mcp-stdio.js'], { env: { ...process.env, HOUSTON_MCP_JSON: file } });
  t.after(() => { child.kill(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const lines = readline.createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  /** @param {object} msg */
  const ask = async (msg) => { child.stdin.write(`${JSON.stringify(msg)}\n`); return JSON.parse((await lines.next()).value); };

  assert.equal((await ask({ jsonrpc: '2.0', id: 1, method: 'ping' })).error.code, -32000);
  fs.writeFileSync(file, JSON.stringify({ url: `http://127.0.0.1:${port}/mcp`, token: TOKEN }));
  assert.equal((await ask({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {} })).result.serverInfo.name, 'houston');
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  assert.deepEqual((await ask({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { x: 1 } } })).result.structuredContent, { x: 1 });
});
