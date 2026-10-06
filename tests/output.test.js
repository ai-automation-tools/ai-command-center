import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendOutput, cleanOutput, lastLines } from '../src/shared/output.js';

test('cleanOutput strips colours, cursor moves, titles and hyperlinks, keeps the text', () => {
  const raw = '\x1b[?25l\x1b[2J\x1b[H\x1b]0;PowerShell\x07\x1b[32mPS D:\\app>\x1b[0m npm test\r\n\x1b]8;;https://x.example\x1b\\link\x1b]8;;\x1b\\ done\r\n\x1b[?25h';
  assert.equal(cleanOutput(raw), 'PS D:\\app> npm test\nlink done\n');
});

test('cleanOutput resolves carriage returns and drops control characters but keeps tabs', () => {
  assert.equal(cleanOutput('10%\r50%\r100%\r\nok\tdone\x07\x00'), '100%\nok\tdone');
  assert.equal(cleanOutput('a\r\n\r\nb'), 'a\n\nb');
  // PSReadLine redraws the typed line with cursor-to-column-1 and erase-line codes.
  assert.equal(cleanOutput('PS> npm tes\x1b[1G\x1b[2KPS> npm test\x1b[12;1H\x1b[?25hPS> npm test\r\nok\r\n'), 'PS> npm test\nok\n');
  assert.equal(cleanOutput('col\x1b[11Gkeep'), 'colkeep');
  assert.equal(cleanOutput(''), '');
});

test('lastLines returns the newest lines without trailing blanks', () => {
  const text = 'one\ntwo\nthree\nfour\n\n  \n';
  assert.equal(lastLines(text, 2), 'three\nfour');
  assert.equal(lastLines(text, 10), 'one\ntwo\nthree\nfour');
  assert.equal(lastLines('', 5), '');
  assert.equal(lastLines('\n\n', 5), '');
});

test('appendOutput keeps only the newest characters', () => {
  assert.equal(appendOutput('abc', 'def', 100), 'abcdef');
  assert.equal(appendOutput('abcdef', 'ghij', 5), 'fghij');
  assert.equal(appendOutput('', 'x'.repeat(10), 4), 'xxxx');
});
