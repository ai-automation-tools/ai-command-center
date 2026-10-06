// Cronsole in the app: its task list through Cronsole's own MCP server (a stdio
// process, newline-delimited JSON-RPC), and its web UI in a pinned tab. No Electron
// here, and nothing Node-only either: the shell UI imports isCronsoleUrl.
// src/main/cronsole.js starts the process and holds the client.

export const DEFAULT_UI = 'http://localhost:7373';
const TIMEOUT_MS = 20_000;
const MAX_TASKS = 500;
const MAX_TASK_ID = 200;
const PROTOCOL_VERSION = '2025-06-18';

/**
 * @typedef {{ id: string, name: string, platform: string, schedule: string | null, status: string,
 *   nextRunTime: string | null, lastRunStatus: string | null, lastRunAt: string | null }} CronTask
 */

/**
 * Where Cronsole is. ACC_CRONSOLE_MCP is the path to its MCP server's entry script
 * (`mcp-server/dist/index.js` in a Cronsole checkout); unset means no task list.
 * ACC_CRONSOLE_UI is its web UI, http or https only, else Cronsole's default port.
 * @param {Record<string, string | undefined>} env
 */
export function cronsoleConfig(env) {
  const server = (env.ACC_CRONSOLE_MCP || '').trim().replace(/^"(.*)"$/, '$1');
  return { server, ui: uiOrigin(env.ACC_CRONSOLE_UI) };
}

/** @param {string | undefined} raw */
function uiOrigin(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin;
  } catch { /* fall through */ }
  return DEFAULT_UI;
}

/**
 * Whether a tab is showing Cronsole's UI, which makes it the pinned tab.
 * @param {string} url
 * @param {string} ui origin from cronsoleConfig
 */
export function isCronsoleUrl(url, ui) {
  try {
    return new URL(url).origin === ui;
  } catch {
    return false;
  }
}

/**
 * A JSON-RPC client over a stdio stream: `write` sends one line, `receive` takes
 * whatever the process printed. Lines that aren't JSON-RPC answers to a pending
 * request (server requests, notifications, stray logs) are ignored.
 * @param {(line: string) => void} write
 * @param {number} [timeoutMs]
 */
export function stdioRpc(write, timeoutMs = TIMEOUT_MS) {
  let nextId = 0;
  let buffer = '';
  /** @type {Map<number, { resolve: (v: any) => void, reject: (e: Error) => void, timer: ReturnType<typeof setTimeout> }>} */
  const pending = new Map();

  return {
    /** @param {string} method @param {object} [params] @returns {Promise<any>} */
    request(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Cronsole's MCP server didn't answer ${method} within ${timeoutMs / 1000} s`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      });
    },

    /** @param {string} method @param {object} [params] */
    notify(method, params = {}) {
      write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
    },

    /** @param {string} chunk */
    receive(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = /** @type {string} */ (lines.pop());
      for (const line of lines) {
        /** @type {any} */
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const p = typeof msg?.id === 'number' && !('method' in msg) ? pending.get(msg.id) : undefined;
        if (!p) continue;
        pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(`Cronsole's MCP server: ${msg.error.message || 'error'}`));
        else p.resolve(msg.result);
      }
    },

    /** Fail everything still waiting, e.g. when the process exits. @param {Error} err */
    fail(err) {
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(err); }
      pending.clear();
      buffer = '';
    },
  };
}

/** The handshake MCP requires before tools/call. @param {ReturnType<typeof stdioRpc>} rpc @param {string} version */
export async function initialize(rpc, version) {
  await rpc.request('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'ai-command-center', version },
  });
  rpc.notify('notifications/initialized');
}

/** @param {ReturnType<typeof stdioRpc>} rpc */
export async function listTasks(rpc) {
  return taskRows(await rpc.request('tools/call', { name: 'list_tasks', arguments: { limit: MAX_TASKS } }));
}

/**
 * A Cronsole task id as list_tasks returns it: short, printable, one line.
 * @param {unknown} value
 */
export function taskIdArg(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TASK_ID || /[\p{Cc}\p{Cf}]/u.test(value)) {
    throw new Error(`task must be a Cronsole task id from cron_tasks (at most ${MAX_TASK_ID} characters)`);
  }
  return value.trim();
}

/**
 * Start a task now through Cronsole's run_task, for the cron_run tool. Cronsole runs
 * its native jobs inside the call, so the result can say the job ran and failed; that
 * is a finding, not a tool error.
 * @param {ReturnType<typeof stdioRpc>} rpc
 * @param {string} taskId
 */
export async function runTask(rpc, taskId) {
  const result = await rpc.request('tools/call', { name: 'run_task', arguments: { taskId } });
  const text = toolText(result);
  if (result?.isError) throw new Error(text || 'Cronsole refused run_task');
  return result?.structuredContent && typeof result.structuredContent === 'object' ? result.structuredContent : { text };
}

/** The text parts of a tools/call result. @param {any} result */
function toolText(result) {
  return Array.isArray(result?.content) ? result.content.map((/** @type {any} */ c) => c?.text).filter(Boolean).join('\n') : '';
}

/**
 * list_tasks' result as rows for the sidebar. A tool error throws its text; anything
 * malformed in a row becomes null or is dropped, since this is another program's output.
 * @param {any} result
 * @returns {CronTask[]}
 */
export function taskRows(result) {
  if (result?.isError) throw new Error(toolText(result) || 'Cronsole refused list_tasks');
  const tasks = result?.structuredContent?.tasks;
  if (!Array.isArray(tasks)) return [];
  /** @param {unknown} v */
  const str = (v) => (typeof v === 'string' && v ? v : null);
  return tasks
    .filter((t) => str(t?.id) && str(t?.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      platform: str(t.platform) || 'UNKNOWN',
      schedule: str(t.schedule),
      status: str(t.status) || 'UNKNOWN',
      nextRunTime: str(t.nextRunTime),
      lastRunStatus: str(t.lastRunStatus),
      lastRunAt: str(t.lastRunAt),
    }));
}

/**
 * How the sidebar shows a task: an icon, a short note on the right (the next run, or
 * why it won't run) and the full details for the tooltip.
 * @param {CronTask} t
 * @param {number} now ms since the epoch
 */
export function taskSummary(t, now) {
  const failed = /fail|error/i.test(t.lastRunStatus || '');
  const icon = t.status === 'DISABLED' ? '⏸' : t.status === 'MISSING' ? '⚠' : failed ? '✗' : '⏱';
  const next = t.nextRunTime ? Date.parse(t.nextRunTime) : NaN;
  const sub = t.status !== 'ACTIVE' ? t.status.toLowerCase()
    : Number.isFinite(next) ? (next > now ? `in ${span(next - now)}` : 'due')
      : t.schedule || '';
  const title = [
    `${t.name}  [${t.platform}]`,
    t.schedule && `Schedule: ${t.schedule}`,
    `Status: ${t.status}`,
    t.nextRunTime && `Next run: ${t.nextRunTime}`,
    t.lastRunAt && `Last run: ${t.lastRunAt}${t.lastRunStatus ? ` (${t.lastRunStatus})` : ''}`,
  ].filter(Boolean).join('\n');
  return { icon, sub, title, failed };
}

/** @param {number} ms */
function span(ms) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${Math.max(m, 1)}m`;
  if (m < 48 * 60) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}
