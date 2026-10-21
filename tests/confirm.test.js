import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Confirmations, isFreshRunTarget } from '../src/shared/confirm.js';

/** @param {number} [timeoutMs] */
function setup(timeoutMs = 1000) {
  /** @type {any[]} */
  const shown = [];
  /** @type {number[]} */
  const cancelled = [];
  /** @type {Confirmations<number>} */
  const c = new Confirmations({ show: (a) => shown.push(a), cancel: (id) => cancelled.push(id), timeoutMs });
  return { c, shown, cancelled };
}

test('an ask shows its payload with an id and settles with the answer, once', async () => {
  const { c, shown, cancelled } = setup();
  const p = c.ask({ command: 'git status' });
  assert.deepEqual(shown, [{ command: 'git status', id: 1 }]);
  assert.equal(c.settle(1, 7), true);
  assert.equal(c.settle(1, 9), false);
  assert.equal(await p, 7);
  assert.deepEqual(cancelled, []);
});

test('asks settle independently, and unknown ids are ignored', async () => {
  const { c } = setup();
  const a = c.ask({ command: 'a' });
  const b = c.ask({ command: 'b' });
  assert.equal(c.settle(99, 1), false);
  c.settle(2, null);
  c.settle(1, 3);
  assert.deepEqual([await a, await b], [3, null]);
});

test('an unanswered ask times out to null, tells the UI, and a late answer does nothing', async () => {
  const { c, cancelled } = setup(10);
  assert.equal(await c.ask({ command: 'x' }), null);
  assert.deepEqual(cancelled, [1]);
  assert.equal(c.settle(1, 5), false);
});

test('isFreshRunTarget takes only a running PowerShell terminal opened for the ask, in its folder', () => {
  const ask = { sinceId: 5, cwd: 'D:/work/app' };
  const t = { id: 5, powershell: true, exited: false, cwd: 'd:\\work\\app\\' };
  assert.equal(isFreshRunTarget(t, ask), true);
  assert.equal(isFreshRunTarget(undefined, ask), false, 'gone');
  assert.equal(isFreshRunTarget({ ...t, id: 4 }, ask), false, 'opened before the ask: may hold typed input or a running program');
  assert.equal(isFreshRunTarget({ ...t, powershell: false }, ask), false, 'cmd or Git Bash');
  assert.equal(isFreshRunTarget({ ...t, exited: true }, ask), false, 'exited');
  assert.equal(isFreshRunTarget({ ...t, cwd: 'D:/work' }, ask), false, 'another folder');
});

test('an ask whose caller goes away is withdrawn from the UI and settles to null', async () => {
  const { c, shown, cancelled } = setup();
  const ctrl = new AbortController();
  const p = c.ask({ command: 'npm test' }, ctrl.signal);
  assert.equal(shown.length, 1);
  ctrl.abort();
  assert.equal(await p, null);
  assert.deepEqual(cancelled, [1]);
  assert.equal(c.settle(1, 7), false, 'a late click does nothing');
  assert.equal(await c.ask({ command: 'x' }, AbortSignal.abort()), null, 'already gone: never shown');
  assert.equal(shown.length, 1);
});
