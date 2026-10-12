import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_URL, API_VERSION, addUserText, chatAttach, chatConfig, chatText, mcpClient, messagesApi, runTurn, toApiTools, toolOutcome, withAttachments } from '../src/shared/chat.js';
import { createMcpServer } from '../src/shared/mcp.js';

test('chatConfig reads the key and model from the environment, with no default model', () => {
  assert.deepEqual(chatConfig({}), { apiKey: '', model: '', missing: ['ANTHROPIC_API_KEY (or ACC_CHAT_API_KEY)', 'ACC_CHAT_MODEL (or ANTHROPIC_MODEL)'] });
  assert.deepEqual(chatConfig({ ANTHROPIC_API_KEY: ' k1 ', ANTHROPIC_MODEL: ' m1 ' }), { apiKey: 'k1', model: 'm1', missing: [] });
  const both = chatConfig({ ANTHROPIC_API_KEY: 'k1', ACC_CHAT_API_KEY: 'k2', ANTHROPIC_MODEL: 'm1', ACC_CHAT_MODEL: 'm2' });
  assert.equal(both.apiKey, 'k2');
  assert.equal(both.model, 'm2');
  assert.deepEqual(chatConfig({ ANTHROPIC_API_KEY: '   ', ACC_CHAT_MODEL: 'm' }).missing, ['ANTHROPIC_API_KEY (or ACC_CHAT_API_KEY)']);
});

test('chatText trims and refuses blank, oversized and non-string input', () => {
  assert.equal(chatText('  hi  '), 'hi');
  assert.throws(() => chatText('   '));
  assert.throws(() => chatText(undefined));
  assert.throws(() => chatText({ text: 'hi' }));
  assert.throws(() => chatText('x'.repeat(20_001)));
});

test('toApiTools and toolOutcome translate between MCP and the Messages API', () => {
  assert.deepEqual(toApiTools([{ name: 'a', description: 'A', inputSchema: { type: 'object', properties: {} } }, { name: 'b' }]), [
    { name: 'a', description: 'A', input_schema: { type: 'object', properties: {} } },
    { name: 'b', description: '', input_schema: { type: 'object' } },
  ]);
  assert.deepEqual(toolOutcome({ result: { content: [{ type: 'text', text: '{"id":1}' }] } }), { text: '{"id":1}', isError: false });
  assert.deepEqual(toolOutcome({ result: { content: [{ type: 'text', text: 'denied' }], isError: true } }), { text: 'denied', isError: true });
  assert.deepEqual(toolOutcome({ error: { code: -32602, message: 'Unknown tool: x' } }), { text: 'Unknown tool: x', isError: true });
  assert.deepEqual(toolOutcome(null), { text: 'null', isError: false });
  assert.deepEqual(toolOutcome({ result: { content: 'junk' } }), { text: 'null', isError: false });
});

test('addUserText keeps the roles alternating', () => {
  /** @type {import('../src/shared/chat.js').Message[]} */
  const m = [];
  addUserText(m, 'one');
  assert.deepEqual(m, [{ role: 'user', content: 'one' }]);
  addUserText(m, 'two');
  assert.deepEqual(m, [{ role: 'user', content: [{ type: 'text', text: 'one' }, { type: 'text', text: 'two' }] }]);
  m.push({ role: 'assistant', content: 'ok' });
  addUserText(m, 'three');
  assert.equal(m.length, 3);
});

/** @param {any[]} replies */
const scripted = (replies) => {
  /** @type {any[]} */
  const bodies = [];
  return { bodies, post: async (/** @type {any} */ body) => { bodies.push(structuredClone(body)); return replies.shift(); } };
};

test('runTurn posts, runs the tools Claude asks for, and posts the results', async () => {
  const { bodies, post } = scripted([
    { stop_reason: 'tool_use', content: [{ type: 'text', text: 'Opening it.' }, { type: 'tool_use', id: 't1', name: 'open_tab', input: { url: 'example.com' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] },
  ]);
  /** @type {any[]} */
  const events = [];
  /** @type {any[]} */
  const messages = [];
  await runTurn({
    messages, text: 'open example.com', model: 'm', tools: [{ name: 'open_tab' }], post,
    callTool: async (name, input) => ({ text: JSON.stringify({ name, input }), isError: false }),
    onEvent: (e) => events.push(e),
  });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].model, 'm');
  assert.deepEqual(bodies[0].tools, [{ name: 'open_tab', description: '', input_schema: { type: 'object' } }]);
  assert.deepEqual(bodies[1].messages[2], { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"name":"open_tab","input":{"url":"example.com"}}', is_error: false }] });
  assert.deepEqual(events.map((e) => e.type), ['text', 'tool', 'result', 'text']);
  assert.equal(messages.length, 4);
});

test('runTurn reports tool errors and thrown tools to Claude, and stops after maxSteps', async () => {
  const use = (/** @type {string} */ id) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'boom', input: {} }] });
  const { bodies, post } = scripted([use('a'), use('b'), use('c')]);
  /** @type {any[]} */
  const events = [];
  /** @type {any[]} */
  const messages = [];
  await runTurn({
    messages, text: 'go', model: 'm', tools: [], post, maxSteps: 2,
    callTool: async () => { throw new Error('nope'); },
    onEvent: (e) => events.push(e),
  });
  assert.equal(bodies.length, 2);
  assert.deepEqual(messages[2].content, [{ type: 'tool_result', tool_use_id: 'a', content: 'nope', is_error: true }]);
  assert.match(events.at(-1).text, /Stopped after 2 rounds/);
  // The next message joins the trailing tool results instead of starting a second user turn.
  addUserText(messages, 'carry on');
  assert.equal(messages.at(-1).content.at(-1).text, 'carry on');
  assert.equal(messages.at(-2).role, 'assistant');
});

test('chatAttach takes page and terminal only, and refuses anything else', () => {
  assert.deepEqual(chatAttach(undefined), []);
  assert.deepEqual(chatAttach(null), []);
  assert.deepEqual(chatAttach([]), []);
  assert.deepEqual(chatAttach(['terminal', 'page', 'page']), ['terminal', 'page']);
  assert.throws(() => chatAttach('page'), /page and terminal only/);
  assert.throws(() => chatAttach(['page', 'cron_run']));
  assert.throws(() => chatAttach(['__proto__']));
  assert.throws(() => chatAttach([{}]));
});

test('withAttachments puts each attachment above the text, or says it failed', () => {
  assert.equal(withAttachments('hi', []), 'hi');
  assert.equal(
    withAttachments('what failed?', [{ kind: 'page', text: 'P', isError: false }, { kind: 'terminal', text: 'No terminal is open', isError: true }]),
    "<attached page>\nP\n</attached page>\n\n(The terminal couldn't be attached: No terminal is open)\n\nwhat failed?",
  );
});

test('runTurn reads attachments through the tools before posting, and shows the calls', async () => {
  const { bodies, post } = scripted([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] }]);
  /** @type {any[]} */
  const events = [];
  /** @type {string[]} */
  const called = [];
  await runTurn({
    messages: [], text: 'summarise', model: 'm', tools: [], post, attach: ['page', 'terminal'],
    callTool: async (name) => { called.push(name); if (name === 'terminal_read') throw new Error('No terminal is open'); return { text: 'Example Domain', isError: false }; },
    onEvent: (e) => events.push(e),
  });
  assert.deepEqual(called, ['read_tab', 'terminal_read']);
  assert.deepEqual(events.map((e) => e.type), ['tool', 'result', 'tool', 'result', 'text']);
  assert.equal(events[3].ok, false);
  assert.equal(bodies[0].messages[0].content, "<attached page>\nExample Domain\n</attached page>\n\n(The terminal couldn't be attached: No terminal is open)\n\nsummarise");
});

test('runTurn answers every tool_use even when the stop reason is not tool_use', async () => {
  const { bodies, post } = scripted([
    { stop_reason: 'max_tokens', content: [{ type: 'tool_use', id: 'x', name: 'recent', input: {} }] },
    { stop_reason: 'end_turn', content: [] },
  ]);
  await runTurn({ messages: [], text: 'hi', model: 'm', tools: [], post, callTool: async () => ({ text: '[]', isError: false }) });
  assert.equal(bodies.length, 2);
});

test('messagesApi sends the key and version headers and surfaces API errors', async () => {
  /** @type {any[]} */
  const calls = [];
  /** @param {number} status @param {any} json */
  const fake = (status, json) => /** @type {typeof fetch} */ (async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(json), { status });
  });
  const ok = await messagesApi('sk-test', fake(200, { content: [], stop_reason: 'end_turn' }))({ model: 'm' });
  assert.deepEqual(ok, { content: [], stop_reason: 'end_turn' });
  assert.equal(calls[0].url, API_URL);
  assert.equal(calls[0].init.headers['x-api-key'], 'sk-test');
  assert.equal(calls[0].init.headers['anthropic-version'], API_VERSION);
  await assert.rejects(messagesApi('k', fake(401, { error: { message: 'invalid x-api-key' } }))({}), /401: invalid x-api-key/);
  await assert.rejects(messagesApi('k', fake(200, { nope: true }))({}), /without content/);
  const html = /** @type {typeof fetch} */ (async () => new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
  await assert.rejects(messagesApi('k', html)({}), /502/);
});

test('a chat turn drives a real MCP server over HTTP with its token', async (t) => {
  const TOKEN = 'b'.repeat(64);
  /** @type {any[]} */
  const opened = [];
  const tools = new Map([
    ['open_tab', { description: 'Open a tab', inputSchema: { type: 'object' }, run: (/** @type {any} */ a) => { opened.push(a.url); return { id: 7 }; } }],
    ['terminal_run', { description: 'Run', inputSchema: { type: 'object' }, run: () => { throw new Error('The user denied this command.'); } }],
  ]);
  /** @type {string[]} */
  const logged = [];
  const server = createMcpServer({ token: TOKEN, tools, version: '0', onCall: (e) => logged.push(e.tool || e.method) });
  await new Promise((r) => server.listen(0, '127.0.0.1', () => r(undefined)));
  t.after(() => server.close());
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const url = `http://127.0.0.1:${port}/mcp`;

  const client = mcpClient(url, TOKEN);
  const list = await client.list();
  assert.deepEqual(list.map((x) => x.name), ['open_tab', 'terminal_run']);
  const { bodies, post } = scripted([
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 'u1', name: 'open_tab', input: { url: 'example.com' } },
      { type: 'tool_use', id: 'u2', name: 'terminal_run', input: { command: 'npm test' } },
    ] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Opened; the command was denied.' }] },
  ]);
  await runTurn({ messages: [], text: 'go', model: 'm', tools: list, post, callTool: (n, a) => client.call(n, a) });
  assert.deepEqual(opened, ['example.com']);
  assert.deepEqual(bodies[1].messages[2].content, [
    { type: 'tool_result', tool_use_id: 'u1', content: '{"id":7}', is_error: false },
    { type: 'tool_result', tool_use_id: 'u2', content: 'The user denied this command.', is_error: true },
  ]);
  assert.deepEqual(logged, ['tools/list', 'open_tab', 'terminal_run']);

  const wrong = mcpClient(url, 'wrong');
  assert.deepEqual(await wrong.call('open_tab', {}), { text: 'MCP server answered 401', isError: true });
  await assert.rejects(wrong.list(), /401/);
});
