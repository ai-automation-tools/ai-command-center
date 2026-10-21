// Dev servers the app starts from the active workspace's package.json: which scripts
// count as one, which package manager runs them, the address a server prints once it's
// up, and its acc://dev/<id> log page. Pure; src/main/devservers.js owns the processes
// and only ever stops one it started.

import { findLinks } from './links.js';

/** Servers kept in the list at once, running or not. */
export const DEV_MAX = 8;

const SCRIPT = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,63}$/;
// ponytail: dev servers by script name only; a repo whose server is `npm run web` doesn't
// show it. Widen the list (or read every script) if that comes up.
const DEV_SCRIPT = /^(dev|start|serve|preview|watch)(:|$)/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/** A script name safe to put on a command line: letters, digits and `:._-`. @param {unknown} v */
export const isScriptName = (v) => typeof v === 'string' && SCRIPT.test(v);

/**
 * The scripts in a package.json that start a dev server (dev, start, serve, preview,
 * watch and their `name:variant`s), in file order. Bad JSON or no scripts gives [].
 * @param {string} text the file's contents
 */
export function devScripts(text) {
  let pkg;
  try { pkg = JSON.parse(text); } catch { return []; }
  const scripts = pkg && typeof pkg === 'object' ? pkg.scripts : null;
  if (!scripts || typeof scripts !== 'object') return [];
  return Object.keys(scripts).filter((k) => isScriptName(k) && DEV_SCRIPT.test(k) && typeof scripts[k] === 'string');
}

/**
 * The package manager a folder uses, from its lockfile; npm when there is none.
 * @param {(file: string) => boolean} has whether the folder holds that file
 * @returns {'pnpm' | 'yarn' | 'npm'}
 */
export function packageManager(has) {
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('yarn.lock')) return 'yarn';
  return 'npm';
}

/**
 * The first loopback address in a server's output (Vite's "Local: http://localhost:5173/",
 * Next's "- Local: http://localhost:3000"), or null. 0.0.0.0 means every interface, so
 * it becomes 127.0.0.1; a LAN address is skipped.
 * @param {string} text output with the escapes already gone
 * @returns {{ url: string, port: number } | null}
 */
export function readyAddress(text) {
  for (const line of text.split('\n')) {
    for (const { url } of findLinks(line)) {
      const u = new URL(url);
      if (!LOOPBACK.has(u.hostname) || !u.port) continue;
      if (u.hostname === '0.0.0.0') u.hostname = '127.0.0.1';
      return { url: u.href, port: Number(u.port) };
    }
  }
  return null;
}

/**
 * A server's state in a few words: its address once it's up, its exit code once it ends.
 * @param {{ state: string, url: string, code: number | null }} s
 */
export function devStateText({ state, url, code }) {
  if (state === 'ready') return url;
  if (state === 'exited') return code === null ? 'failed to start' : `exited (code ${code})`;
  return state === 'starting' || state === 'stopping' ? `${state}…` : state;
}

/** @param {number} id */
export const devUrl = (id) => `acc://dev/${id}`;

/** The server id in an acc://dev/<id> address, or null. @param {string} url */
export function devIdFromUrl(url) {
  const m = /^acc:\/\/dev\/(\d{1,6})\/?$/i.exec(url);
  return m ? Number(m[1]) : null;
}
