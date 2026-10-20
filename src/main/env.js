// The app's configuration: `.env` at the repo root (see .env.example) under the real
// environment, which wins. Kept apart from process.env so terminals, which inherit
// process.env, never see the chat key.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');

/**
 * @param {string} file
 * @param {Record<string, string | undefined>} [base]
 * @returns {Record<string, string | undefined>}
 */
export function loadEnv(file, base = process.env) {
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'ENOENT') throw err;
  }
  return { ...parseEnv(text), ...base };
}

export const env = loadEnv(ENV_FILE);
