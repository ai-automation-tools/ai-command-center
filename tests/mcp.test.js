import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSIONS, bearerMatches, createMcpServer, handleMessage, isLoopbackHost, isLoopbackOrigin } from '../src/shared/mcp.js';

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

test('handleMessage answers malformed params, arguments, ids and names with JSON-RPC errors', async () => {
  const code = async (/** @type {any} */ msg) => (await handleMessage(msg, tools, ''))?.error?.code;
  assert.equal(await code({ jsonrpc: '2.0', id: 1, method: 'initialize', params: null }), -32602);
  assert.equal(await code({ jsonrpc: '2.0', id: 1, method: 'initialize', params: [] }), -32602);
  assert.equal(await code({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: 'echo' }), -32602);
  for (const args of [null, [], 'x', 5]) {
    assert.equal(await code({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: args } }), -32602, JSON.stringify(args));
  }
  assert.equal(await code({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: { toString: 1 } } }), -32602);
  assert.equal(await code({ jsonrpc: '2.0', id: {}, method: 'ping' }), -32600);
  assert.equal(await code({ jsonrpc: '2.0', id: null, method: 'ping' }), -32600);
});

test('structuredContent is only ever a JSON object', async () => {
  const shaped = new Map([
    ['list', { description: '', inputSchema: { type: 'object' }, run: () => [1, 2] }],
    ['none', { description: '', inputSchema: { type: 'object' }, run: () => null }],
    ['obj', { description: '', inputSchema: { type: 'object' }, run: () => ({ tabs: [] }) }],
  ]);
  const res = async (/** @type {string} */ name) => /** @type {any} */ ((await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name } }, shaped, ''))?.result);
  assert.equal('structuredContent' in await res('list'), false);
  assert.equal((await res('list')).content[0].text, '[1,2]');
  assert.equal('structuredContent' in await res('none'), false);
  assert.deepEqual((await res('obj')).structuredContent, { tabs: [] });
});

test('isLoopbackOrigin takes only loopback http(s) origins', () => {
  assert.equal(isLoopbackOrigin('http://127.0.0.1:5173'), true);
  assert.equal(isLoopbackOrigin('http://localhost'), true);
  assert.equal(isLoopbackOrigin('https://evil.example'), false);
  assert.equal(isLoopbackOrigin('http://localhost.evil.example'), false);
  assert.equal(isLoopbackOrigin('null'), false);
});

/** @param {import('node:test').TestContext} t @param {Map<string, any>} [toolMap] */
async function serve(t, toolMap = tools) {
  const server = createMcpServer({ token: TOKEN, tools: toolMap, version: '0.1.0' });
  await new Promise((r) => server.listen(0, '127.0.0.1', () => r(undefined)));
  t.after(() => server.close());
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const url = `http://127.0.0.1:${port}/mcp`;
  return (/** @type {unknown} */ msg, /** @type {Record<string, string>} */ headers = {}) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${TOKEN}`, ...headers }, body: JSON.stringify(msg) });
}

test('the HTTP server refuses foreign origins and unsupported protocol versions', async (t) => {
  const post = await serve(t);
  const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };
  assert.equal((await post(ping, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(ping, { Origin: 'http://localhost:3000' })).status, 200);
  assert.equal((await post(ping, { 'MCP-Protocol-Version': '1999-01-01' })).status, 400);
  assert.equal((await post(ping, { 'MCP-Protocol-Version': PROTOCOL_VERSIONS[0] })).status, 200);
});

test('a failure inside the handler becomes a JSON-RPC error, and the next request still works', async (t) => {
  const broken = new Map(tools);
  broken.get = () => { throw new Error('boom'); };
  const post = await serve(t, broken);
  const res = await post({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'echo' } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { jsonrpc: '2.0', id: 9, error: { code: -32603, message: 'Internal error' } });
  assert.deepEqual(await (await post({ jsonrpc: '2.0', id: 10, method: 'ping' })).json(), { jsonrpc: '2.0', id: 10, result: {} });
});

test('a strict client session: initialize, initialized, tools/list, tools/call, every reply well-formed', async (t) => {
  const post = await serve(t);
  /** @param {any} r @param {number} id */
  const wellFormed = (r, id) => {
    assert.equal(r.jsonrpc, '2.0');
    assert.equal(r.id, id);
    assert.equal(('result' in r) !== ('error' in r), true, 'exactly one of result and error');
  };
  const init = await (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSIONS[0], capabilities: {}, clientInfo: { name: 'strict', version: '1' } } })).json();
  wellFormed(init, 1);
  assert.equal(init.result.protocolVersion, PROTOCOL_VERSIONS[0]);
  assert.equal(typeof init.result.serverInfo.name, 'string');
  const h = { 'MCP-Protocol-Version': init.result.protocolVersion };
  assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, h)).status, 202);
  const list = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, h)).json();
  wellFormed(list, 2);
  for (const tool of list.result.tools) {
    assert.equal(typeof tool.name, 'string');
    assert.equal(tool.inputSchema.type, 'object');
  }
  for (const [id, name] of [[3, 'echo'], [4, 'boom']]) {
    const call = await (await post({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: { a: 1 } } }, h)).json();
    wellFormed(call, id);
    assert.equal(Array.isArray(call.result.content), true);
    for (const c of call.result.content) assert.deepEqual(Object.keys(c).sort(), ['text', 'type']);
    if ('structuredContent' in call.result) assert.equal(typeof call.result.structuredContent === 'object' && !Array.isArray(call.result.structuredContent), true);
  }
});

test('a client that disconnects mid-call aborts the tool it was waiting on', async (t) => {
  /** @type {(v: boolean) => void} */
  let heard = () => {};
  const aborted = new Promise((r) => { heard = r; });
  const waiting = new Map([['wait', {
    description: '', inputSchema: { type: 'object' },
    run: (/** @type {any} */ _a, /** @type {{ signal?: AbortSignal }} */ { signal } = {}) => new Promise((resolve) => {
      signal?.addEventListener('abort', () => { heard(true); resolve(null); });
    }),
  }]]);
  const server = createMcpServer({ token: TOKEN, tools: waiting, version: '' });
  await new Promise((r) => server.listen(0, '127.0.0.1', () => r(undefined)));
  t.after(() => server.close());
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const client = new AbortController();
  const call = fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST', signal: client.signal,
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'wait' } }),
  }).catch((/** @type {Error} */ e) => e.name);
  setTimeout(() => client.abort(), 50);
  assert.equal(await call, 'AbortError');
  assert.equal(await aborted, true);
});
