// Dev servers started from the Dev tab: `<npm|pnpm|yarn> run <script>` in the active
// workspace's folder, for a script its package.json names (src/shared/devservers.js).
// Each keeps its output, the address it printed and its state. Stop and Restart act only
// on a process this module spawned, by the pid spawn gave it, and only while it runs;
// every one still running is stopped when the window closes.

import { execFile, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DEV_MAX, devIdFromUrl, devScripts, devStateText, isScriptName, packageManager, readyAddress } from '../shared/devservers.js';
import { appendOutput, cleanOutput, lastLines } from '../shared/output.js';
import { devLogPage } from '../shared/docs.js';
import { childEnv, onPath } from './env.js';

const WIN = process.platform === 'win32';
const SYSTEM32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
const LOG_LINES = 2000;
// No browser window of its own (create-react-app and friends), and no colour codes.
const SERVER_ENV = { BROWSER: 'none', FORCE_COLOR: '0' };

/**
 * @typedef {'starting' | 'ready' | 'stopping' | 'stopped' | 'exited'} DevState
 * @typedef {{ id: number, folder: string, script: string, manager: string, state: DevState, code: number | null, url: string, port: number | null, startedAt: number, output: string, child: import('node:child_process').ChildProcess | null, restart: boolean }} Server
 */

/** What the renderer gets: no process handle, no output. @param {Server} s */
const view = ({ child, output, restart, ...rest }) => ({ ...rest, pid: child?.pid ?? null, text: devStateText(rest) });

/**
 * Ends a server's whole process tree: npm starts cmd, which starts node, and killing
 * only the first leaves the server listening.
 * @param {import('node:child_process').ChildProcess} child
 * @param {boolean} [sync] at shutdown, so it's done before the app exits
 */
function killTree(child, sync = false) {
  if (!WIN || !child.pid) return void child.kill();
  const args = ['/pid', String(child.pid), '/t', '/f'];
  if (sync) {
    try { execFileSync(path.join(SYSTEM32, 'taskkill.exe'), args, { stdio: 'ignore', windowsHide: true }); } catch { /* already gone */ }
  } else {
    execFile(path.join(SYSTEM32, 'taskkill.exe'), args, { windowsHide: true }, () => {});
  }
}

export class DevServers {
  /** @param {(channel: string, ...args: unknown[]) => void} send */
  constructor(send) {
    this.send = send;
    /** @type {Map<number, Server>} */
    this.servers = new Map();
    this.nextId = 1;
  }

  /**
   * The dev scripts a folder's package.json has and the package manager that runs them,
   * or why there are none.
   * @param {string} folder
   */
  scripts(folder) {
    if (!folder) return { scripts: [], manager: null, reason: 'Open a folder as a workspace to start its dev servers.' };
    let text;
    try {
      text = fs.readFileSync(path.join(folder, 'package.json'), 'utf8');
    } catch {
      return { scripts: [], manager: null, reason: `${folder} has no package.json.` };
    }
    const scripts = devScripts(text);
    return {
      scripts,
      manager: packageManager((f) => fs.existsSync(path.join(folder, f))),
      reason: scripts.length ? '' : 'Its package.json has no dev, start, serve, preview or watch script.',
    };
  }

  list() {
    return [...this.servers.values()].map(view);
  }

  /**
   * Start a script from the folder's package.json; a stopped server for the same script
   * starts again in its place.
   * @param {string} folder
   * @param {string} script
   */
  start(folder, script) {
    const same = [...this.servers.values()].find((s) => s.folder === folder && s.script === script);
    if (same?.child) throw new Error(`${script} is already running in ${folder}.`);
    const s = same ?? this.add(folder, script);
    this.spawn(s);
    return view(s);
  }

  /** @param {number} id */
  stop(id) {
    const s = this.get(id);
    if (s.child && s.state !== 'stopping') {
      s.state = 'stopping';
      killTree(s.child);
      this.changed();
    }
    return view(s);
  }

  /** Stop it if it runs, then start the same script again. @param {number} id */
  restart(id) {
    const s = this.get(id);
    if (!s.child) this.spawn(s);
    else {
      s.restart = true;
      this.stop(id);
    }
    return view(s);
  }

  /** At shutdown: end every server this run started. */
  stopAll() {
    for (const s of this.servers.values()) if (s.child) killTree(s.child, true);
  }

  /** The acc://dev/<id> page: the server's state and its last lines of output. @param {string} url */
  page(url) {
    const id = devIdFromUrl(url);
    const s = id === null ? undefined : this.servers.get(id);
    if (!s) throw new Error('No dev server has this address. It may have been removed; start it again from the Dev tab.');
    return devLogPage({
      script: s.script,
      folder: s.folder,
      command: `${s.manager} run ${s.script}`,
      state: devStateText(s),
      url: s.url,
      output: lastLines(cleanOutput(s.output), LOG_LINES),
    });
  }

  /** @param {number} id */
  get(id) {
    const s = this.servers.get(id);
    if (!s) throw new Error(`No dev server ${id}.`);
    return s;
  }

  /** @param {string} folder @param {string} script @returns {Server} */
  add(folder, script) {
    if (this.servers.size >= DEV_MAX) {
      // Make room by forgetting the oldest one that isn't running.
      const old = [...this.servers.values()].find((s) => !s.child);
      if (!old) throw new Error(`${DEV_MAX} dev servers are running. Stop one first.`);
      this.servers.delete(old.id);
    }
    /** @type {Server} */
    const s = { id: this.nextId++, folder, script, manager: '', state: 'stopped', code: null, url: '', port: null, startedAt: 0, output: '', child: null, restart: false };
    this.servers.set(s.id, s);
    return s;
  }

  /**
   * Run the script. Checked against package.json again each time, since the file can
   * change between a start and a restart; the name is also checked to be plain, as it
   * goes on cmd's command line.
   * @param {Server} s
   */
  spawn(s) {
    const { scripts, manager } = this.scripts(s.folder);
    if (!manager || !isScriptName(s.script) || !scripts.includes(s.script)) throw new Error(`${s.script} isn't a dev script in ${s.folder}'s package.json.`);
    const options = { cwd: s.folder, env: childEnv(process.env, SERVER_ENV), windowsHide: true, stdio: /** @type {const} */ (['ignore', 'pipe', 'pipe']) };
    let child;
    if (WIN) {
      // npm.cmd is a batch file, so it runs under cmd, by its full path (see onPath).
      const exe = onPath(`${manager}.cmd`);
      if (!exe) throw new Error(`${manager} isn't installed, or isn't on PATH.`);
      child = spawn(path.join(SYSTEM32, 'cmd.exe'), ['/d', '/s', '/c', `""${exe}" run ${s.script}"`], { ...options, windowsVerbatimArguments: true });
    } else {
      child = spawn(manager, ['run', s.script], options);
    }
    Object.assign(s, { manager, child, state: 'starting', code: null, url: '', port: null, startedAt: Date.now(), output: '' });
    const onData = (/** @type {string} */ text) => {
      s.output = appendOutput(s.output, text);
      if (s.state !== 'starting') return;
      const found = readyAddress(cleanOutput(s.output.slice(-8000)));
      if (found) {
        Object.assign(s, { state: 'ready', ...found });
        this.changed();
      }
    };
    for (const stream of [child.stdout, child.stderr]) {
      stream?.setEncoding('utf8');
      stream?.on('data', onData);
    }
    const ended = (/** @type {number | null} */ code, /** @type {string} */ why) => {
      if (s.child !== child) return;
      s.output = appendOutput(s.output, `\n[${why}]\n`);
      Object.assign(s, { child: null, code, state: s.state === 'stopping' ? 'stopped' : 'exited' });
      if (s.restart) {
        s.restart = false;
        try {
          this.spawn(s);
        } catch (err) {
          s.output = appendOutput(s.output, `\n[restart failed: ${err instanceof Error ? err.message : err}]\n`);
        }
      }
      this.changed();
    };
    // 'exit', not 'close': a server's own child can hold the pipes open after it ends.
    child.on('exit', (code) => ended(code, `exited with code ${code}`));
    child.on('error', (err) => ended(null, err.message));
    this.changed();
  }

  changed() {
    this.send('dev:changed', this.list());
  }
}
