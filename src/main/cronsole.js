// Cronsole's MCP server as a child process, started on first use. It runs on this
// app's own Electron binary in Node mode, so the only thing configurable is which
// script, and that comes from the user's environment (ACC_CRONSOLE_MCP), never from
// the shell UI. The process inherits the environment for CRONSOLE_TOKEN and
// CRONSOLE_API_URL, the same way Claude Code would start it.

import { app } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { cronsoleConfig, initialize, listTasks, runTask, stdioRpc } from '../shared/cronsole.js';

export function cronsole() {
  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  /** @type {Promise<ReturnType<typeof stdioRpc>> | null} */
  let ready = null;
  let stderr = '';

  /** @param {string} server */
  const start = (server) => {
    if (!fs.existsSync(server)) throw new Error(`ACC_CRONSOLE_MCP points at ${server}, which doesn't exist.`);
    const proc = spawn(process.execPath, [server], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child = proc;
    stderr = '';
    const rpc = stdioRpc((line) => proc.stdin?.write(line));
    proc.stdout?.setEncoding('utf8').on('data', (d) => rpc.receive(d));
    // Cronsole's server logs to stderr; keep the tail for the error it exits with.
    proc.stderr?.setEncoding('utf8').on('data', (d) => { stderr = (stderr + d).slice(-2000); });
    const gone = (/** @type {string} */ why) => {
      if (child === proc) { child = null; ready = null; }
      rpc.fail(new Error(`Cronsole's MCP server ${why}${stderr.trim() ? `: ${stderr.trim().split('\n').pop()}` : ''}`));
    };
    proc.on('exit', (code) => gone(`exited (${code})`));
    proc.on('error', (err) => gone(`didn't start (${err.message})`));
    return initialize(rpc, app.getVersion()).then(() => rpc);
  };

  /** The running server, started on first use. */
  const client = () => {
    const { server } = cronsoleConfig(process.env);
    if (!server) throw new Error('Set ACC_CRONSOLE_MCP to the path of Cronsole\'s mcp-server/dist/index.js, then restart the app.');
    if (!ready) {
      ready = start(server);
      ready.catch(() => { ready = null; child?.kill(); });
    }
    return ready;
  };

  return {
    /** For the sidebar: whether a server is set, and where the UI is. */
    info() {
      const { server, ui } = cronsoleConfig(process.env);
      return { configured: Boolean(server), ui };
    },

    tasks: async () => listTasks(await client()),

    /** Start a task now; the main process asks the user first (cron_run). @param {string} taskId */
    run: async (taskId) => runTask(await client(), taskId),

    close() {
      child?.kill();
    },
  };
}
