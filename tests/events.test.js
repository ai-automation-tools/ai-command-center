import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedSse } from '../src/shared/events.js';

const feed = (chunks) => {
  let buffer = '';
  const events = [];
  for (const c of chunks) {
    const out = feedSse(buffer, c);
    buffer = out.buffer;
    events.push(...out.events);
  }
  return { buffer, events };
};

test('feedSse returns change events with their data', () => {
  const { events } = feed(['event: change\ndata: {"why":"src/x.js"}\n\n']);
  assert.deepEqual(events, [{ event: 'change', data: '{"why":"src/x.js"}' }]);
});

test('feedSse ignores the retry preamble, heartbeats and comment lines', () => {
  const { events } = feed(['retry: 3000\n\n: ping\n\n: comment\n\n']);
  assert.deepEqual(events, []);
});

test('feedSse carries a partial event across chunk boundaries', () => {
  const { buffer, events } = feed([
    'event: chan',
    'ge\ndata: {"why"',
    ':"a.md"}\n\n',
  ]);
  assert.deepEqual(events, [{ event: 'change', data: '{"why":"a.md"}' }]);
  assert.equal(buffer, '');
});

test('feedSse finishes several events in one chunk and joins multi-line data', () => {
  const { events } = feed([
    'event: change\ndata: one\ndata: two\n\nevent: change\ndata: three\n\n',
  ]);
  assert.deepEqual(events, [
    { event: 'change', data: 'one\ntwo' },
    { event: 'change', data: 'three' },
  ]);
});

test('feedSse handles CRLF line endings and a trailing space after the colon', () => {
  const { events } = feed(['event: change\r\ndata: {"why":"b"}\r\n\r\n']);
  assert.deepEqual(events, [{ event: 'change', data: '{"why":"b"}' }]);
});

test('feedSse drops a block with no data field', () => {
  const { events } = feed(['event: change\n\n']);
  assert.deepEqual(events, []);
});
