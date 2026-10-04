// The MCP call log: one entry per request the server answers or refuses, for the
// sidebar's MCP panel and %APPDATA%\ai-command-center\logs\mcp.log. Pure; the server
// (shared/mcp.js) reports calls and the main process stores them.

export const LOG_KEEP = 200;
const MAX_ARGS = 300;
const MAX_ERROR = 300;

/**
 * @typedef {{
 *   at: number, method: string, tool?: string, args?: string,
 *   ok: boolean, ms: number, status?: number, error?: string,
 * }} LogEntry
 */

/** @param {string} s @param {number} max */
const clip = (s, max) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * One request and what came of it. `msg` is whatever the client sent (trust nothing);
 * `out` is the JSON-RPC response, or null for a notification.
 * @param {{ msg: any, out: any, ms: number, at?: number }} call
 * @returns {LogEntry}
 */
export function describeCall({ msg, out, ms, at = Date.now() }) {
  const method = typeof msg?.method === 'string' ? clip(msg.method, 100) : '(invalid)';
  /** @type {LogEntry} */
  const entry = { at, method, ok: true, ms };
  if (method === 'tools/call') {
    if (typeof msg.params?.name === 'string') entry.tool = clip(msg.params.name, 100);
    if (msg.params?.arguments !== undefined) entry.args = clip(JSON.stringify(msg.params.arguments) ?? '', MAX_ARGS);
  }
  const error = out?.error?.message ?? (out?.result?.isError ? out.result.content?.[0]?.text : undefined);
  if (error !== undefined) {
    entry.ok = false;
    entry.error = clip(String(error), MAX_ERROR);
  }
  return entry;
}

/**
 * A request refused before it was read: no token, wrong Host, wrong path or method.
 * @param {number} status
 * @param {string} reason
 * @returns {LogEntry}
 */
export function refusedCall(status, reason, at = Date.now()) {
  return { at, method: '(refused)', ok: false, ms: 0, status, error: reason };
}

/** @param {LogEntry} entry */
export function logLine(entry) {
  return `${JSON.stringify({ ...entry, at: new Date(entry.at).toISOString() })}\n`;
}

/**
 * Newest first, capped.
 * @param {LogEntry[]} list
 * @param {LogEntry} entry
 */
export function pushEntry(list, entry, keep = LOG_KEEP) {
  list.unshift(entry);
  if (list.length > keep) list.length = keep;
  return list;
}
