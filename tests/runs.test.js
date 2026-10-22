import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNS_KEEP, RUN_OUTPUT_MAX, RUN_SCRIPT, Runs, runInfo } from '../src/shared/runs.js';

const P = { command: 'npm test', cwd: 'D:\\work\\app' };

test('a run succeeds or fails on its exit code alone', () => {
  const runs = new Runs();
  const a = runs.start({ ...P, terminal: 3 }, 100);
  const b = runs.start({ ...P, terminal: 4 }, 100);
  assert.deepEqual([a.run, b.run], [1, 2]);
  assert.equal(runs.get(), b);
  runs.end(3, 0, 'FAILED: everything (just text)', 400);
  runs.end(4, 2, 'all good', 500);
  assert.deepEqual([a.state, a.exitCode, a.endedAt], ['succeeded', 0, 400]);
  assert.deepEqual([b.state, b.exitCode], ['failed', 2]);
  assert.deepEqual(runInfo(a), { run: 1, terminal: 3, command: 'npm test', cwd: 'D:\\work\\app', state: 'succeeded', exitCode: 0, startedAt: 100, endedAt: 400, durationMs: 300 });
});

test('cancel ends a running run with no exit code; a later exit changes nothing', () => {
  const runs = new Runs();
  const r = runs.start({ ...P, terminal: 7 }, 0);
  runs.cancel(7, 'partial', 50);
  runs.end(7, 1, 'late', 60);
  assert.deepEqual([r.state, r.exitCode, r.endedAt, r.output], ['cancelled', null, 50, 'partial']);
  assert.equal(runs.cancel(7, ''), undefined);
  assert.equal(runs.end(99, 0, ''), undefined, 'a terminal that never ran a command');
  assert.equal(runInfo(runs.start({ ...P, terminal: 8 }, 1000), 1600).durationMs, 600);
});

test('only the newest finished runs and the end of their output are kept', () => {
  const runs = new Runs();
  const first = runs.start({ ...P, terminal: 1 });
  for (let i = 2; i <= RUNS_KEEP + 5; i++) runs.end(i, 0, 'x'.repeat(RUN_OUTPUT_MAX + 10), runs.start({ ...P, terminal: i }).startedAt);
  assert.equal(runs.list.length, RUNS_KEEP);
  assert.equal(runs.get(1), first, 'still running, so kept');
  assert.equal(runs.get(2), undefined);
  assert.equal(runs.get()?.output?.length, RUN_OUTPUT_MAX);
});

test('the run script takes the command from the environment, never as an argument', () => {
  assert.match(RUN_SCRIPT, /\$env:ACC_RUN_COMMAND; Remove-Item Env:ACC_RUN_COMMAND/);
  assert.match(RUN_SCRIPT, /\[scriptblock\]::Create\(\$c\)/);
  assert.doesNotMatch(RUN_SCRIPT, /[\r\n]/);
});
