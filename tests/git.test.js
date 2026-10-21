import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT_ARGS, STATUS_ARGS, diffAreas, diffArgs, diffLines, gitFromUrl, gitUrl, parseStatus } from '../src/shared/git.js';

test('every git call switches off what a repo could make it run', () => {
  for (const args of [ROOT_ARGS, STATUS_ARGS, diffArgs('staged', 'a'), diffArgs('unstaged', 'a'), diffArgs('untracked', 'a')]) {
    assert.ok(args.includes('core.fsmonitor=false') && args.includes('diff.external=') && args.includes('--no-pager'), args.join(' '));
  }
  for (const area of /** @type {const} */ (['staged', 'unstaged', 'untracked'])) {
    const a = diffArgs(area, '--output=x');
    assert.ok(a.includes('--no-ext-diff') && a.includes('--no-textconv'));
    // The path comes after "--", so it can't be taken for an option.
    assert.equal(a[a.length - 1], '--output=x');
    assert.ok(a.indexOf('--') < a.length - 1);
  }
  assert.ok(diffArgs('staged', 'a').includes('--cached'));
  assert.ok(!diffArgs('unstaged', 'a').includes('--cached'));
  assert.deepEqual(diffArgs('untracked', 'new.js').slice(-4), ['--no-index', '--', '/dev/null', 'new.js']);
});

test('parseStatus reads the branch, ahead and behind, and every kind of entry', () => {
  const out = [
    '# branch.oid 1234567890abcdef',
    '# branch.head mike_desktop',
    '# branch.upstream origin/mike_desktop',
    '# branch.ab +2 -1',
    '1 M. N... 100644 100644 100644 aaa bbb src/main/git.js',
    '1 .M N... 100644 100644 100644 aaa bbb docs/a file with spaces.md',
    '1 MM N... 100644 100644 100644 aaa bbb README.md',
    '2 R. N... 100644 100644 100644 aaa bbb R100 src/new.js',
    'src/old.js',
    'u UU N... 100644 100644 100644 100644 a b c merge.txt',
    '? notes/todo.md',
    '! node_modules/x',
    '',
  ].join('\0');
  const st = parseStatus(out);
  assert.deepEqual([st.branch, st.upstream, st.ahead, st.behind], ['mike_desktop', 'origin/mike_desktop', 2, 1]);
  assert.deepEqual(st.files, [
    { path: 'src/main/git.js', from: null, staged: 'M', unstaged: null, kind: 'changed' },
    { path: 'docs/a file with spaces.md', from: null, staged: null, unstaged: 'M', kind: 'changed' },
    { path: 'README.md', from: null, staged: 'M', unstaged: 'M', kind: 'changed' },
    { path: 'src/new.js', from: 'src/old.js', staged: 'R', unstaged: null, kind: 'renamed' },
    { path: 'merge.txt', from: null, staged: null, unstaged: 'UU', kind: 'conflict' },
    { path: 'notes/todo.md', from: null, staged: null, unstaged: '?', kind: 'untracked' },
  ]);
  assert.deepEqual(diffAreas(st.files[2]), ['staged', 'unstaged']);
  assert.deepEqual(diffAreas(st.files[0]), ['staged']);
  assert.deepEqual(diffAreas(st.files[5]), ['untracked']);
  // A new repo with no commits and no upstream.
  const fresh = parseStatus('# branch.oid (initial)\0# branch.head main\0');
  assert.deepEqual([fresh.branch, fresh.upstream, fresh.ahead, fresh.behind, fresh.files.length], ['main', null, 0, 0, 0]);
  assert.deepEqual(parseStatus(''), { branch: '', upstream: null, ahead: 0, behind: 0, files: [] });
});

test('acc://git addresses round-trip a path and an area, and refuse anything else', () => {
  for (const [path, area] of /** @type {const} */ ([['src/a b#c?.js', 'staged'], ['ünïcode/файл.md', 'unstaged'], ['new.js', 'untracked']])) {
    assert.deepEqual(gitFromUrl(gitUrl(path, area)), { path, area });
  }
  assert.equal(gitFromUrl('acc://git/a.js'), null);
  assert.equal(gitFromUrl('acc://git/a.js?area=all'), null);
  assert.equal(gitFromUrl('acc://doc/a.js?area=staged'), null);
  assert.equal(gitFromUrl('acc://git/%E0%A4%A?area=staged'), null);
  assert.equal(gitFromUrl('acc://git/a%0Ab?area=staged'), null);
});

test('diffLines classes each line, and caps a huge diff', () => {
  const { lines, truncated } = diffLines('diff --git a/x b/x\r\nindex 1..2 100644\n--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n same\n-old\n+new\n');
  assert.deepEqual(lines.map((l) => l.cls), ['meta', 'meta', 'meta', 'meta', 'hunk', 'ctx', 'del', 'add']);
  assert.equal(lines[7].text, '+new');
  assert.equal(truncated, false);
  const big = diffLines(Array.from({ length: 6000 }, (_, i) => `+${i}`).join('\n'));
  assert.equal(big.lines.length, 5000);
  assert.equal(big.truncated, true);
});
