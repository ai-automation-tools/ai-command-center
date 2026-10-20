import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv } from '../src/main/env.js';

test('loadEnv reads .env and lets the real environment win', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'acc-env-')), '.env');
  fs.writeFileSync(file, '# comment\nACC_CHAT_MODEL=from-file\nACC_CHAT_API_KEY="k"\n');
  assert.deepEqual(loadEnv(file, { ACC_CHAT_MODEL: 'from-env' }), { ACC_CHAT_MODEL: 'from-env', ACC_CHAT_API_KEY: 'k' });
});

test('loadEnv without a .env is just the environment', () => {
  assert.deepEqual(loadEnv(path.join(os.tmpdir(), 'acc-env-missing', '.env'), { A: '1' }), { A: '1' });
});
