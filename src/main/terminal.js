// Shell sessions behind the xterm.js panel. The renderer can pick a starting folder
// and a profile from shared/shells.js by id, and nothing else: each profile's
// executable and arguments are fixed, so no message from a page can start a shell
// with chosen arguments (the rule from the Project Control Center's ADR-004).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pty from 'node-pty';
import { pickShell, shellProfiles } from '../shared/shells.js';

/** @param {unknown} dir */
function safeCwd(dir) {
  if (typeof dir === 'string' && dir) {
    try {
      if (fs.statSync(dir).isDirectory()) return dir;
    } catch { /* fall through to home */ }
  }
  return os.homedir();
}

export class Terminals {
  /** @param {(channel: string, ...args: unknown[]) => void} send */
  constructor(send) {
    this.send = send;
    /** @type {Map<number, import('node-pty').IPty>} */
    this.sessions = new Map();
    /** Session ids running PowerShell, the only ones terminal_run types into. */
    this.powershell = new Set();
    this.nextId = 1;
    this.profiles = shellProfiles(process.env, (f) => fs.existsSync(f));
    this.shell = this.profiles[0].file;
  }

  /** The installed shells, for the new-terminal menu. */
  list() {
    return this.profiles.map(({ id, label, powershell }) => ({ id, label, powershell }));
  }

  /**
   * @param {{ cwd?: string, cols?: number, rows?: number, shell?: string }} opts
   * @returns {{ id: number, cwd: string, shell: string, profile: string, powershell: boolean }}
   */
  create(opts = {}) {
    const cwd = safeCwd(opts.cwd);
    const id = this.nextId++;
    const profile = pickShell(this.profiles, opts.shell);
    const p = pty.spawn(profile.file, profile.args, {
      name: 'xterm-256color',
      cols: clamp(opts.cols, 20, 500, 100),
      rows: clamp(opts.rows, 5, 200, 30),
      cwd,
      env: { ...process.env, TERM_PROGRAM: 'ai-command-center' },
      useConpty: true,
      // The bundled conpty.dll path kills without forking node-pty's console-list helper,
      // which crashes (AttachConsole failed) and keeps the app alive when it quits.
      useConptyDll: true,
    });
    p.onData((data) => this.send('term:data', id, data));
    p.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      this.powershell.delete(id);
      this.send('term:exit', id, exitCode);
    });
    this.sessions.set(id, p);
    if (profile.powershell) this.powershell.add(id);
    return { id, cwd, shell: path.basename(profile.file), profile: profile.id, powershell: profile.powershell };
  }

  /** @param {number} id */
  isPowerShell(id) {
    return this.powershell.has(id);
  }

  /** @param {number} id @param {string} data */
  write(id, data) {
    if (typeof data === 'string') this.sessions.get(id)?.write(data);
  }

  /** @param {number} id @param {number} cols @param {number} rows */
  resize(id, cols, rows) {
    const p = this.sessions.get(id);
    if (!p) return;
    try { p.resize(clamp(cols, 20, 500, 100), clamp(rows, 5, 200, 30)); } catch { /* exited mid-resize */ }
  }

  /** @param {number} id */
  kill(id) {
    const p = this.sessions.get(id);
    if (!p) return;
    this.sessions.delete(id);
    this.powershell.delete(id);
    try { p.kill(); } catch { /* already gone */ }
  }

  killAll() {
    for (const id of [...this.sessions.keys()]) this.kill(id);
  }
}

/** @param {unknown} v @param {number} lo @param {number} hi @param {number} dflt */
function clamp(v, lo, hi, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : dflt;
}
