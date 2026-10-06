// Shell sessions behind the xterm.js panel. The renderer can pick a starting folder
// and a profile from shared/shells.js by id, and nothing else: each profile's
// executable and arguments are fixed, so no message from a page can start a shell
// with chosen arguments (the rule from the Project Control Center's ADR-004).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pty from 'node-pty';
import { pickShell, shellProfiles } from '../shared/shells.js';
import { appendOutput } from '../shared/output.js';

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
    /** What list_terminals reports; kept after exit until the UI closes the tab. */
    /** @type {Map<number, { id: number, shell: string, profile: string, cwd: string, powershell: boolean, exited: boolean }>} */
    this.meta = new Map();
    /** Raw pty output per session, newest OUTPUT_MAX_CHARS, for terminal_read. */
    /** @type {Map<number, string>} */
    this.output = new Map();
    /** The session the UI shows, as it reports it; terminal_read's default. */
    /** @type {number | null} */
    this.activeId = null;
    this.nextId = 1;
    /** @type {Record<string, string>} set once the MCP server is up: ACC_MCP_URL and ACC_MCP_TOKEN */
    this.env = {};
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
      env: { ...process.env, TERM_PROGRAM: 'ai-command-center', ...this.env },
      useConpty: true,
      // The bundled conpty.dll path kills without forking node-pty's console-list helper,
      // which crashes (AttachConsole failed) and keeps the app alive when it quits.
      useConptyDll: true,
    });
    p.onData((data) => {
      this.output.set(id, appendOutput(this.output.get(id) || '', data));
      this.send('term:data', id, data);
    });
    p.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      this.powershell.delete(id);
      const m = this.meta.get(id);
      if (m) m.exited = true;
      this.send('term:exit', id, exitCode);
    });
    this.sessions.set(id, p);
    if (profile.powershell) this.powershell.add(id);
    const info = { id, cwd, shell: path.basename(profile.file), profile: profile.id, powershell: profile.powershell };
    this.meta.set(id, { ...info, exited: false });
    this.output.set(id, '');
    return info;
  }

  /** Every session the UI still shows, oldest first, for list_terminals. */
  listSessions() {
    return [...this.meta.values()].map((m) => ({ ...m, active: m.id === this.activeId }));
  }

  /**
   * The raw output of a session: the one asked for, else the one the UI shows, else
   * the newest. Null when there's no such session.
   * @param {number} [id]
   */
  read(id) {
    const pick = id ?? (this.activeId !== null && this.meta.has(this.activeId) ? this.activeId : [...this.meta.keys()].pop());
    return pick === undefined ? null : { id: pick, raw: this.output.get(pick) ?? null };
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
    this.meta.delete(id);
    this.output.delete(id);
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
