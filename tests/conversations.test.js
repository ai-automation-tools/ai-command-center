import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONVERSATIONS_MAX, NAME_MAX, cleanIndex, conversationText, isConversationId, removeConversation, renameConversation,
  searchConversations, titleFrom, touchConversation,
} from '../src/shared/conversations.js';

const empty = () => cleanIndex(null);

test('cleanIndex keeps good entries, newest first, and an active id only when it is listed', () => {
  assert.deepEqual(empty(), { version: 1, active: null, list: [] });
  const ix = cleanIndex({
    active: 'c2',
    list: [
      { id: 'c1', name: 'old', updated: 1 },
      { id: 'c2', name: 'new\u0007one', updated: 5 },
      { id: 'c1', name: 'dupe', updated: 9 },
      { id: '../x', name: 'bad', updated: 3 },
      { id: 'c3', updated: 'soon' },
      null,
    ],
  });
  assert.deepEqual(ix.list, [{ id: 'c2', name: 'new one', updated: 5 }, { id: 'c1', name: 'old', updated: 1 }, { id: 'c3', name: '', updated: 0 }]);
  assert.equal(ix.active, 'c2');
  assert.equal(cleanIndex({ active: 'c9', list: [{ id: 'c1' }] }).active, null);
  const many = cleanIndex({ list: Array.from({ length: CONVERSATIONS_MAX + 5 }, (_, i) => ({ id: `c${i}`, updated: i })) });
  assert.equal(many.list.length, CONVERSATIONS_MAX);
  assert.equal(many.list[0].id, `c${CONVERSATIONS_MAX + 4}`);
  assert.equal(isConversationId('cabc123'), true);
  for (const bad of ['x1', 'c../a', 'c', 'C1', '', null]) assert.equal(isConversationId(bad), false, String(bad));
});

test('titleFrom names a conversation by its first message, without attachments', () => {
  assert.equal(titleFrom([]), '');
  assert.equal(titleFrom([{ role: 'user', content: '<attached page>\nlots of page text\n</attached page>\n\n  Why did\nthe build fail?' }]), 'Why did the build fail?');
  const long = titleFrom([{ role: 'user', content: 'x'.repeat(200) }]);
  assert.equal(long.length, 50);
  assert.ok(long.endsWith('…'));
  assert.equal(titleFrom([{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'r' }, { type: 'text', text: 'hi' }] }]), 'hi');
});

test('touchConversation adds a new one on its first message, then moves it to the top', () => {
  const msgs = [{ role: /** @type {const} */ ('user'), content: 'deploy steps' }];
  const one = touchConversation(empty(), msgs, 1000);
  assert.equal(one.active, `c${(1000).toString(36)}`);
  assert.deepEqual(one.list, [{ id: one.active, name: 'deploy steps', updated: 1000 }]);
  // A second new one in the same millisecond gets its own id.
  const two = touchConversation({ ...one, active: null }, [{ role: 'user', content: 'other' }], 1000);
  assert.notEqual(two.active, one.active);
  assert.equal(two.list.length, 2);
  // Back to the first: keeps its name, moves up.
  const back = touchConversation({ ...two, active: one.active }, [...msgs, { role: 'user', content: 'more' }], 2000);
  assert.deepEqual(back.list.map((e) => [e.id, e.name, e.updated]), [[one.active, 'deploy steps', 2000], [two.active, 'other', 1000]]);
});

test('rename and remove: blank names fall back, removing the open one leaves a new one open', () => {
  const ix = touchConversation(empty(), [{ role: 'user', content: 'first' }], 1);
  const id = /** @type {string} */ (ix.active);
  assert.equal(renameConversation(ix, id, '  Release plan \n', 'first').list[0].name, 'Release plan');
  assert.equal(renameConversation(ix, id, '   ', 'first').list[0].name, 'first');
  assert.equal(renameConversation(ix, id, 'y'.repeat(200), 'first').list[0].name.length, NAME_MAX);
  assert.throws(() => renameConversation(ix, 'cnope', 'x', ''), /No such conversation/);
  const gone = removeConversation(ix, id);
  assert.deepEqual([gone.active, gone.list.length], [null, 0]);
  const other = touchConversation({ ...ix, active: null }, [{ role: 'user', content: 'second' }], 2);
  assert.equal(removeConversation(other, id).active, other.active);
  assert.throws(() => removeConversation(ix, 'cnope'), /No such conversation/);
});

test('search: every word in the name or text, newest first, with a snippet', () => {
  const items = [
    { id: 'c1', name: 'Deploy', updated: 1, text: conversationText([{ role: 'user', content: '<attached page>\nSECRET page\n</attached page>\n\nhow do I ship it' }, { role: 'assistant', content: [{ type: 'text', text: 'Run the release workflow on main.' }] }]) },
    { id: 'c2', name: 'Tests', updated: 2, text: 'npm test failed in tree.test.js' },
  ];
  assert.equal(items[0].text, 'how do I ship it Run the release workflow on main.');
  assert.deepEqual(searchConversations(items, '').map((e) => e.id), ['c2', 'c1']);
  assert.deepEqual(searchConversations(items, 'RELEASE deploy').map((e) => e.id), ['c1']);
  assert.equal(searchConversations(items, 'release')[0].snippet, 'how do I ship it Run the release workflow on main.');
  assert.deepEqual(searchConversations(items, 'secret'), []);
  assert.equal(searchConversations(items, 'tests')[0].snippet, '');
  const long = searchConversations([{ id: 'c3', name: '', updated: 0, text: `${'a '.repeat(60)}needle${' b'.repeat(60)}` }], 'needle')[0].snippet;
  assert.ok(long.startsWith('…') && long.endsWith('…') && long.includes('needle'));
});
