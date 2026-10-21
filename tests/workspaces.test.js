import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ID, TERMINALS_MAX, WORKSPACES_MAX, addWorkspace, chatFileName, cleanWorkspaces, drivePath, removeWorkspace, saveWorkspace, workspaceSummary,
} from '../src/shared/workspaces.js';

test('cleanWorkspaces: no file means one Default workspace holding the tabs layout.json saved', () => {
  const s = cleanWorkspaces(null, { tabs: ['https://a.com', 'javascript:x'], activeTab: 0 });
  assert.equal(s.version, 1);
  assert.equal(s.active, DEFAULT_ID);
  assert.deepEqual(s.list.map((w) => [w.id, w.tabs, w.activeTab]), [[DEFAULT_ID, ['https://a.com'], 0]]);
});

test('cleanWorkspaces: once the file exists, layout.json tabs are ignored', () => {
  const s = cleanWorkspaces({ list: [] }, { tabs: ['https://a.com'] });
  assert.deepEqual(s.list[0].tabs, []);
});

test('cleanWorkspaces trusts nothing in the file', () => {
  const s = cleanWorkspaces({
    active: 'gone',
    list: [
      { id: 'app', name: ' App ', folder: 'D:\\work\\app', hubId: 'work/app', tabs: ['https://x.com', 'data:,x'], terminals: ['D:\\work\\app', '\\\\server\\share', 'rel', 5] },
      { id: 'app', name: 'dupe', folder: 'D:\\dupe' },
      { id: 'Bad Id', folder: 'D:\\x' },
      { id: 'nofolder', folder: '\\\\server\\share' },
      { id: 'hidden', folder: 'D:\\a\u202eb' },
      null, 'x',
      { id: DEFAULT_ID, name: 'Mine', folder: 'D:\\ignored', tabs: ['https://d.com'] },
    ],
  });
  assert.equal(s.active, DEFAULT_ID, 'an unknown active falls back to Default');
  assert.deepEqual(s.list.map((w) => w.id), [DEFAULT_ID, 'app'], 'Default first, bad entries dropped');
  assert.equal(s.list[0].folder, '');
  assert.equal(s.list[0].name, 'Mine');
  assert.deepEqual(s.list[0].tabs, ['https://d.com']);
  const app = s.list[1];
  assert.equal(app.name, 'App');
  assert.deepEqual(app.tabs, ['https://x.com']);
  assert.deepEqual(app.terminals, ['D:\\work\\app']);
});

test('cleanWorkspaces caps the list and each terminal list', () => {
  const list = Array.from({ length: WORKSPACES_MAX + 5 }, (_, i) => ({ id: `w${i}`, folder: `D:\\w${i}`, terminals: Array(20).fill('D:\\w') }));
  const s = cleanWorkspaces({ active: 'w3', list });
  assert.equal(s.list.length, WORKSPACES_MAX + 1);
  assert.equal(s.active, 'w3');
  assert.equal(s.list[1].terminals.length, TERMINALS_MAX);
});

test('addWorkspace makes a unique id from the name, and reuses a folder it already has', () => {
  let s = cleanWorkspaces({});
  const a = addWorkspace(s, { name: 'Acme API', folder: 'D:\\work\\acme', hubId: 'work/acme' });
  assert.equal(a.id, 'acme-api');
  s = a.state;
  const w = s.list.find((x) => x.id === 'acme-api');
  assert.deepEqual(w?.terminals, ['D:\\work\\acme'], 'a new workspace opens one terminal in its folder');
  assert.equal(addWorkspace(s, { name: 'other', folder: 'd:/WORK/acme/' }).id, 'acme-api', 'same folder, any spelling');
  assert.equal(addWorkspace(s, { name: 'Acme API', folder: 'D:\\elsewhere' }).id, 'acme-api-2');
  assert.equal(addWorkspace(s, { name: 'Default', folder: 'D:\\d' }).id, 'default-2');
  assert.equal(addWorkspace(s, { name: '', folder: 'D:\\work\\Thing' }).id, 'thing');
  assert.throws(() => addWorkspace(s, { name: 'x', folder: '\\\\server\\share' }), /absolute folder/);
  assert.throws(() => addWorkspace(s, { name: 'x', folder: 'relative' }), /absolute folder/);
});

test('removeWorkspace: never Default, and the active one hands over to Default', () => {
  let s = addWorkspace(cleanWorkspaces({}), { name: 'a', folder: 'D:\\a' }).state;
  s = { ...s, active: 'a' };
  assert.throws(() => removeWorkspace(s, DEFAULT_ID), /Default/);
  const r = removeWorkspace(s, 'a');
  assert.deepEqual(r.list.map((w) => w.id), [DEFAULT_ID]);
  assert.equal(r.active, DEFAULT_ID);
});

test("saveWorkspace replaces one workspace's tabs or terminals and nothing else", () => {
  let s = addWorkspace(cleanWorkspaces({}), { name: 'a', folder: 'D:\\a' }).state;
  s = saveWorkspace(s, 'a', { tabs: ['https://x.com', 'about:blank'], activeTab: 0 });
  s = saveWorkspace(s, 'a', { terminals: ['D:\\a', 'D:\\a', 'D:\\b'] });
  const a = s.list[1];
  assert.deepEqual([a.tabs, a.activeTab, a.terminals], [['https://x.com'], 0, ['D:\\a', 'D:\\b']]);
  assert.deepEqual(s.list[0].tabs, []);
});

test('chatFileName keeps chat.json for Default and refuses anything not an id', () => {
  assert.equal(chatFileName(DEFAULT_ID), 'chat.json');
  assert.equal(chatFileName('acme-api'), 'chat-acme-api.json');
  assert.throws(() => chatFileName('../x'), /not a workspace id/);
});

test('workspaceSummary leaves out the saved tabs', () => {
  const s = addWorkspace(cleanWorkspaces({}), { name: 'a', folder: 'D:\\a', hubId: 'a' }).state;
  assert.deepEqual(workspaceSummary(s).list[1], { id: 'a', name: 'a', folder: 'D:\\a', hubId: 'a' });
});

test('drivePath takes absolute drive folders only', () => {
  assert.equal(drivePath('C:/x'), 'C:/x');
  for (const bad of ['', 'x', '\\\\s\\x', 5, null, 'C:x', 'C:\\a\u200bb']) assert.equal(drivePath(bad), '', String(bad));
});
