// PowerShell sessions behind the xterm.js panel. The renderer can pick a starting
// folder and nothing else: the executable and its arguments are fixed here, so no
// message from a page can start a shell with chosen arguments (the rule from the
// Project Control Center's ADR-004).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pty from 'node-pty';

const PWSH_CANDIDATES = [
  path.join(process.env.ProgramFiles || 'C:/Program Files', 'PowerShell', '7', 'pwsh.exe'),
  'pwsh.exe',
  'powershell.exe',
];

function shellPath() {
  for (const p of PWSH_CANDIDATES) {
    if (!path.isAbsolute(p) || fs.existsSync(p)) return p;
  }
  return 'powershell.exe';
}

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
    this.nextId = 1;
    this.shell = shellPath();
  }

  /**
   * @param {{ cwd?: string, cols?: number, rows?: number }} opts
   * @returns {{ id: number, cwd: string, shell: string }}
   */
  create(opts = {}) {
    const cwd = safeCwd(opts.cwd);
    const id = this.nextId++;
    const p = pty.spawn(this.shell, ['-NoLogo'], {
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
      this.send('term:exit', id, exitCode);
    });
    this.sessions.set(id, p);
    return { id, cwd, shell: path.basename(this.shell) };
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
