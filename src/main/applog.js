// Append-only log files under userData\logs, and the crash log: uncaught errors in
// the main process, and renderer, tab or helper processes going away, go to app.log so
// a bug report has something to paste. Past 5 MB a file moves to <name>.1.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * @param {string} name file name under logs/, such as 'mcp.log'
 * @param {string} line already newline-terminated
 */
export function appendLog(name, line) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    const file = path.join(dir, name);
    fs.mkdirSync(dir, { recursive: true });
    if ((fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0) > MAX_BYTES) fs.renameSync(file, `${file}.1`);
    fs.appendFileSync(file, line);
  } catch (err) {
    console.error(`[log] could not write ${name}:`, err);
  }
}

/**
 * @param {string} kind what went wrong, one word
 * @param {unknown} detail an Error or a string
 */
export function logError(kind, detail) {
  const text = detail instanceof Error ? detail.stack || detail.message : String(detail);
  console.error(`[${kind}]`, text);
  appendLog('app.log', `${new Date().toISOString()} ${kind} ${text.replace(/\r?\n/g, '\n    ')}\n`);
}

/** Hook the process and app events that would otherwise end in a dialog or silence. */
export function logCrashes() {
  process.on('uncaughtException', (err) => logError('uncaughtException', err));
  process.on('unhandledRejection', (reason) => logError('unhandledRejection', reason));
  app.on('render-process-gone', (_e, wc, d) => {
    let url = '';
    try { url = wc.getURL(); } catch { /* already destroyed */ }
    logError('render-process-gone', `${d.reason} (exit ${d.exitCode}) ${url}`);
  });
  app.on('child-process-gone', (_e, d) => logError('child-process-gone', `${d.type} ${d.name || ''} ${d.reason} (exit ${d.exitCode})`));
}
