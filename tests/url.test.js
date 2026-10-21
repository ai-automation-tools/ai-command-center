import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedNavigation, toUrl } from '../src/shared/url.js';

test('toUrl keeps full URLs as they are', () => {
  assert.equal(toUrl('https://example.com/x?y=1'), 'https://example.com/x?y=1');
  assert.equal(toUrl('file:///D:/a/b.html'), 'file:///D:/a/b.html');
  assert.equal(toUrl('about:blank'), 'about:blank');
});

test('toUrl turns Windows paths into file URLs', () => {
  assert.equal(toUrl('D:\\work\\site\\index.html'), 'file:///D:/work/site/index.html');
  assert.equal(toUrl('C:/x/y.html'), 'file:///C:/x/y.html');
});

test('toUrl sends loopback to http, hosts to https', () => {
  assert.equal(toUrl('127.0.0.1:4273'), 'http://127.0.0.1:4273');
  assert.equal(toUrl('localhost:5173/app'), 'http://localhost:5173/app');
  assert.equal(toUrl('example.com'), 'https://example.com');
  assert.equal(toUrl('docs.example.com/news'), 'https://docs.example.com/news');
});

test('toUrl searches everything else', () => {
  assert.equal(toUrl('electron web contents view'), 'https://www.google.com/search?q=electron%20web%20contents%20view');
  assert.equal(toUrl('node.js'), 'https://node.js', 'a two-letter-plus TLD reads as a host; accepted trade-off');
  assert.equal(toUrl('   '), 'about:blank');
});

test('isAllowedNavigation refuses script and data URLs', () => {
  assert.equal(isAllowedNavigation('https://a.com'), true);
  assert.equal(isAllowedNavigation('file:///D:/x.html'), true);
  assert.equal(isAllowedNavigation('javascript:alert(1)'), false);
  assert.equal(isAllowedNavigation('data:text/html,hi'), false);
  assert.equal(isAllowedNavigation('vscode://file/D:/x'), false);
});

test('isAllowedNavigation: a local file opens from the app or another local file, never from a web or extension page', () => {
  assert.equal(isAllowedNavigation('file:///D:/x.html', 'file:///D:/index.html'), true);
  assert.equal(isAllowedNavigation('file:///C:/Users/me/.ssh/id_rsa', 'https://evil.example/'), false);
  assert.equal(isAllowedNavigation('FILE:///C:/x', 'http://localhost:3000/'), false);
  assert.equal(isAllowedNavigation('file:///C:/x', 'chrome-extension://abc/popup.html'), false);
  assert.equal(isAllowedNavigation('file:///C:/x', 'about:blank'), false);
});
