// The app's configuration: `.env` at the repo root (see .env.example) under the real
// environment, which wins. Kept apart from process.env, and every child process gets
// its environment from childEnv(), so terminals and Cronsole never see the chat key.

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

/** The app's own credentials (the chat key, under either name): never passed to a child. */
const APP_SECRETS = new Set(['ACC_CHAT_API_KEY', 'ANTHROPIC_API_KEY']);

/**
 * The environment for a terminal or other child process: `base` without the app's own
 * credentials, whether they came from .env or the real environment, plus `extra`.
 * Names match case-insensitively, as Windows matches them.
 * @param {Record<string, string | undefined>} base
 * @param {Record<string, string>} [extra]
 * @returns {Record<string, string | undefined>}
 */
export function childEnv(base, extra = {}) {
  return { ...Object.fromEntries(Object.entries(base).filter(([k]) => !APP_SECRETS.has(k.toUpperCase()))), ...extra };
}
