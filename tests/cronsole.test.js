import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_UI, cronsoleConfig, initialize, isCronsoleUrl, listTasks, runTask, stdioRpc, taskIdArg, taskRows, taskSummary } from '../src/shared/cronsole.js';

test('cronsoleConfig reads the server path and the UI origin, http(s) only', () => {
  assert.deepEqual(cronsoleConfig({}), { server: '', ui: DEFAULT_UI });
  assert.deepEqual(cronsoleConfig({ ACC_CRONSOLE_MCP: ' "D:/work/cronsole/mcp-server/dist/index.js" ', ACC_CRONSOLE_UI: 'http://127.0.0.1:8080/tasks?x=1' }),
    { server: 'D:/work/cronsole/mcp-server/dist/index.js', ui: 'http://127.0.0.1:8080' });
  for (const bad of ['javascript:alert(1)', 'file:///C:/Users/dev', 'localhost:7373', '   ', 'acc://shell/index.html']) {
    assert.equal(cronsoleConfig({ ACC_CRONSOLE_UI: bad }).ui, DEFAULT_UI, bad);
  }
});

test('isCronsoleUrl matches the UI origin exactly', () => {
  assert.equal(isCronsoleUrl('http://localhost:7373/', DEFAULT_UI), true);
  assert.equal(isCronsoleUrl('http://localhost:7373/tasks/abc', DEFAULT_UI), true);
  assert.equal(isCronsoleUrl('http://localhost:7374/', DEFAULT_UI), false);
  assert.equal(isCronsoleUrl('https://localhost:7373/', DEFAULT_UI), false);
  assert.equal(isCronsoleUrl('http://localhost:7373.example.com/', DEFAULT_UI), false);
  assert.equal(isCronsoleUrl('', DEFAULT_UI), false);
  assert.equal(isCronsoleUrl('not a url', DEFAULT_UI), false);
});

/**
 * A fake Cronsole MCP server on the other end of stdioRpc: answers each request line,
 * in chunks split mid-line, with a log line and a server notification mixed in.
 * @param {(msg: any) => any} answer
 */
function fakeServer(answer) {
  /** @type {any[]} */
  const seen = [];
  /** @type {ReturnType<typeof stdioRpc>} */
  const rpc = stdioRpc((line) => {
    const msg = JSON.parse(line);
    seen.push(msg);
    if (!('id' in msg)) return;
    const out = `not json\n${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/message', params: {} })}\n${JSON.stringify({ jsonrpc: '2.0', id: msg.id, ...answer(msg) })}\n`;
    const mid = Math.floor(out.length / 2);
    setImmediate(() => { rpc.receive(out.slice(0, mid)); rpc.receive(out.slice(mid)); });
  });
  return { rpc, seen };
}

const TASK = { id: 't1', name: 'Nightly backup', platform: 'WINDOWS_TASK_SCHEDULER', category: null, schedule: '0 2 * * *', status: 'ACTIVE', nextRunTime: '2026-10-05T02:00:00.000Z', lastRunStatus: 'SUCCESS', lastRunAt: '2026-10-04T02:00:00.000Z' };

test('initialize then list_tasks over stdio, the way the sidebar asks', async () => {
  const { rpc, seen } = fakeServer((msg) => {
    if (msg.method === 'initialize') return { result: { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'cronsole' } } };
    if (msg.method === 'tools/call') return { result: { content: [{ type: 'text', text: '1 task(s).' }], structuredContent: { matched: 1, returned: 1, tasks: [TASK] } } };
    return { error: { code: -32601, message: 'nope' } };
  });
  await initialize(rpc, '0.1.0');
  const tasks = await listTasks(rpc);
  assert.deepEqual(seen.map((m) => m.method), ['initialize', 'notifications/initialized', 'tools/call']);
  assert.equal(seen[0].params.clientInfo.name, 'ai-command-center');
  assert.deepEqual(seen[2].params, { name: 'list_tasks', arguments: { limit: 500 } });
  assert.deepEqual(tasks, [{ id: 't1', name: 'Nightly backup', platform: 'WINDOWS_TASK_SCHEDULER', schedule: '0 2 * * *', status: 'ACTIVE', nextRunTime: '2026-10-05T02:00:00.000Z', lastRunStatus: 'SUCCESS', lastRunAt: '2026-10-04T02:00:00.000Z' }]);
});

test('runTask calls run_task with the id and returns the result; a tool error throws; a failed run is a result', async () => {
  const { rpc, seen } = fakeServer((msg) => {
    const id = msg.params?.arguments?.taskId;
    if (id === 'bad') return { result: { isError: true, content: [{ type: 'text', text: 'No task with id bad' }] } };
    if (id === 'text-only') return { result: { content: [{ type: 'text', text: 'Started.' }] } };
    return { result: { content: [{ type: 'text', text: 'ran' }], structuredContent: { ran: true, success: false, exitCode: 1 } } };
  });
  assert.deepEqual(await runTask(rpc, 't1'), { ran: true, success: false, exitCode: 1 });
  assert.deepEqual(seen.at(-1).params, { name: 'run_task', arguments: { taskId: 't1' } });
  assert.deepEqual(await runTask(rpc, 'text-only'), { text: 'Started.' });
  await assert.rejects(runTask(rpc, 'bad'), /No task with id bad/);
});

test('taskIdArg takes a short printable id and refuses the rest', () => {
  assert.equal(taskIdArg(' t1 '), 't1');
  for (const bad of ['', '  ', 5, null, 'a\nb', 'x\u200b', 'y'.repeat(201)]) assert.throws(() => taskIdArg(bad), String(bad));
});

test('stdioRpc surfaces JSON-RPC errors, times out, and fails what is pending', async () => {
  const { rpc } = fakeServer(() => ({ error: { code: -32601, message: 'Method not found' } }));
  await assert.rejects(rpc.request('x'), /Method not found/);

  const silent = stdioRpc(() => {}, 20);
  await assert.rejects(silent.request('initialize'), /didn't answer initialize/);

  const dying = stdioRpc(() => {});
  const p = dying.request('tools/call');
  dying.receive('{"jsonrpc":"2.0","id":99,"result":{}}\n{"jsonrpc":"2.0","id":1,"method":"sampling/createMessage"}\n');
  dying.fail(new Error('exited (1)'));
  await assert.rejects(p, /exited \(1\)/);
});

test('taskRows: tool errors throw their text, malformed rows are dropped or nulled', () => {
  assert.throws(() => taskRows({ isError: true, content: [{ type: 'text', text: 'Cronsole API error (HTTP 403): Invalid or expired token' }] }), /HTTP 403/);
  assert.throws(() => taskRows({ isError: true }), /refused list_tasks/);
  assert.deepEqual(taskRows(null), []);
  assert.deepEqual(taskRows({ content: [] }), []);
  assert.deepEqual(taskRows({ structuredContent: { tasks: 'junk' } }), []);
  const rows = taskRows({ structuredContent: { tasks: [null, 7, { id: 'x' }, { name: 'no id' }, { id: 'a', name: 'A', platform: 3, schedule: '', status: null, nextRunTime: {}, lastRunAt: 'then' }] } });
  assert.deepEqual(rows, [{ id: 'a', name: 'A', platform: 'UNKNOWN', schedule: null, status: 'UNKNOWN', nextRunTime: null, lastRunStatus: null, lastRunAt: 'then' }]);
});

test('taskSummary: next run, paused, missing and failed tasks', () => {
  const now = Date.parse('2026-10-04T20:00:00.000Z');
  const row = /** @type {import('../src/shared/cronsole.js').CronTask} */ ({ ...TASK, nextRunTime: '2026-10-04T20:30:00.000Z' });
  assert.deepEqual({ ...taskSummary(row, now), title: undefined }, { icon: '⏱', sub: 'in 30m', title: undefined, failed: false });
  assert.match(taskSummary(row, now).title, /Nightly backup {2}\[WINDOWS_TASK_SCHEDULER\]\nSchedule: 0 2 \* \* \*\nStatus: ACTIVE\nNext run: .*\nLast run: .*\(SUCCESS\)/);
  assert.equal(taskSummary({ ...row, nextRunTime: '2026-10-05T02:00:00.000Z' }, now).sub, 'in 6h');
  assert.equal(taskSummary({ ...row, nextRunTime: '2026-10-09T20:00:00.000Z' }, now).sub, 'in 5d');
  assert.equal(taskSummary({ ...row, nextRunTime: '2026-10-04T19:00:00.000Z' }, now).sub, 'due');
  assert.equal(taskSummary({ ...row, nextRunTime: null }, now).sub, '0 2 * * *');
  assert.equal(taskSummary({ ...row, nextRunTime: 'garbage', schedule: null }, now).sub, '');
  assert.deepEqual([taskSummary({ ...row, status: 'DISABLED' }, now).icon, taskSummary({ ...row, status: 'DISABLED' }, now).sub], ['⏸', 'disabled']);
  assert.equal(taskSummary({ ...row, status: 'MISSING' }, now).icon, '⚠');
  const failed = taskSummary({ ...row, lastRunStatus: 'FAILURE' }, now);
  assert.equal(failed.icon, '✗');
  assert.equal(failed.failed, true);
});
