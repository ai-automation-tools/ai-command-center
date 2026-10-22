// Ends a process the app started together with everything it started: npm starts cmd,
// which starts node, and a run's PowerShell starts whatever the command runs. Only ever
// called with a pid the app got back from spawning, while that process still runs.

import { execFile, execFileSync } from 'node:child_process';
import path from 'node:path';

const TASKKILL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');

/**
 * @param {number | undefined} pid
 * @param {boolean} [sync] at shutdown, so it's done before the app exits
 * @returns {boolean} false off Windows or without a pid: the caller kills it its own way
 */
export function killTree(pid, sync = false) {
  if (process.platform !== 'win32' || !pid) return false;
  const args = ['/pid', String(pid), '/t', '/f'];
  if (sync) {
    try { execFileSync(TASKKILL, args, { stdio: 'ignore', windowsHide: true }); } catch { /* already gone */ }
  } else {
    execFile(TASKKILL, args, { windowsHide: true }, () => {});
  }
  return true;
}
