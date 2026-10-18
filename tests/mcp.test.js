import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSIONS, bearerMatches, createMcpServer, handleMessage, isLoopbackHost } from '../src/shared/mcp.js';

const TOKEN = 'a'.repeat(64);
const tools = new Map([
  ['echo', { description: 'Echo', inputSchema: { type: 'object' }, run: (/** @type {any} */ a) => a }],
  ['boom', { description: 'Fails', inputSchema: { type: 'object' }, run: () => { throw new Error('nope'); } }],
]);

test('bearerMatches needs the exact token', () => {
  assert.equal(bearerMatches(`Bearer ${TOKEN}`, TOKEN), true);
  assert.equal(bearerMatches(undefined, TOKEN), false);
  assert.equal(bearerMatches('Bearer ', TOKEN), false);
  assert.equal(bearerMatches(`Bearer ${TOKEN}x`, TOKEN), false);
  assert.equal(bearerMatches('Bearer ', ''), false);
});

test('isLoopbackHost refuses anything but loopback', () => {
  assert.equal(isLoopbackHost('127.0.0.1:5000'), true);
  assert.equal(isLoopbackHost('localhost:5000'), true);
  assert.equal(isLoopbackHost('evil.com'), false);
  assert.equal(isLoopbackHost('127.0.0.1.evil.com:5000'), false);
  assert.equal(isLoopbackHost(undefined), false);
});

test('handleMessage: initialize, notifications, tools, errors', async () => {
  const init = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, tools, '0.1.0');
  assert.equal(/** @type {any} */ (init?.result).protocolVersion, '2025-06-18');
  const odd = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, tools, '0.1.0');
  assert.equal(/** @type {any} */ (odd?.result).protocolVersion, PROTOCOL_VERSIONS[0]);
  assert.equal(await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, tools, ''), null);
  const list = await handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, tools, '');
  assert.deepEqual(/** @type {any} */ (list?.result).tools.map((/** @type {any} */ t) => t.name), ['echo', 'boom']);
  assert.equal('annotations' in /** @type {any} */ (list?.result).tools[0], false);
  const call = await handleMessage({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { x: 1 } } }, tools, '');
  assert.deepEqual(/** @type {any} */ (call?.result).structuredContent, { x: 1 });
  const fail = await handleMessage({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'boom' } }, tools, '');
  assert.equal(/** @type {any} */ (fail?.result).isError, true);
  assert.equal((await handleMessage({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } }, tools, ''))?.error?.code, -32602);
  assert.equal((await handleMessage({ jsonrpc: '2.0', id: 6, method: 'nope' }, tools, ''))?.error?.code, -32601);
  assert.equal((await handleMessage([{ jsonrpc: '2.0', id: 7, method: 'ping' }], tools, ''))?.error?.code, -32600);
});

test('the HTTP server refuses calls without the token and answers with it', async (t) => {
  const server = createMcpServer({ token: TOKEN, tools, version: '0.1.0' });
  await new Promise((r) => server.listen(0, '127.0.0.1', () => r(undefined)));
  t.after(() => server.close());
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const url = `http://127.0.0.1:${port}/mcp`;
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const post = (/** @type {Record<string, string>} */ headers) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });

  assert.equal((await post({})).status, 401);
  assert.equal((await post({ Authorization: 'Bearer wrong' })).status, 401);
  const ok = await post({ Authorization: `Bearer ${TOKEN}` });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).result.tools.length, 2);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })).status, 405);
  const note = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  assert.equal(note.status, 202);
  const bad = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: '{' });
  assert.equal(bad.status, 400);
});
