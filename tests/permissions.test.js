import test from 'node:test';
import assert from 'node:assert/strict';
import { isPermissionAllowed } from '../src/shared/permissions.js';

test('pages get fullscreen, pointer lock and sanitized clipboard writes, nothing else', () => {
  for (const p of ['fullscreen', 'pointerLock', 'clipboard-sanitized-write']) assert.equal(isPermissionAllowed(p), true, p);
  for (const p of ['media', 'geolocation', 'notifications', 'midi', 'midiSysex', 'display-capture', 'clipboard-read',
    'openExternal', 'idle-detection', 'hid', 'serial', 'usb', 'fileSystem', 'unknown', '', undefined, null, {}]) {
    assert.equal(isPermissionAllowed(p), false, String(p));
  }
});
