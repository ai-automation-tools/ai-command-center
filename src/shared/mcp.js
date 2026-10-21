// The Control Center MCP server: JSON-RPC over MCP's Streamable HTTP transport, plain
// JSON responses only (no SSE stream, no sessions). No Electron here, so tests can run
// it for real; src/main/mcp.js starts it and hands it the tools.
//
// Every request must carry `Authorization: Bearer <token>` and a loopback Host header,
// and a browser's Origin header, when there is one, must be loopback too (both stop DNS
// rebinding from a web page reaching the port).

import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { describeCall, expectedCall, refusedCall } from './mcplog.js';

export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const MAX_BODY = 1024 * 1024;

/**
 * @typedef {{ readOnlyHint?: boolean, destructiveHint?: boolean, idempotentHint?: boolean, openWorldHint?: boolean }} ToolAnnotations
 * @typedef {{ description: string, inputSchema: object, annotations?: ToolAnnotations, run: (args: any, ctx?: { signal?: AbortSignal }) => unknown }} Tool
 *   ctx.signal aborts when the client disconnects before the answer, so a tool waiting on the user can give up
 * @typedef {{ jsonrpc: '2.0', id: string | number | null, result?: unknown, error?: { code: number, message: string } }} Response
 */

/**
 * @param {string | undefined} header
 * @param {string} token
 */
export function bearerMatches(header, token) {
  const got = Buffer.from(String(header || '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(token);
  return token.length > 0 && got.length === want.length && timingSafeEqual(got, want);
}

/** @param {string | undefined} host */
export function isLoopbackHost(host) {
  return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(host || ''));
}

/**
 * One JSON-RPC message in, one response out, or null for a notification.
 * @param {any} msg
 * @param {Map<string, Tool>} tools
 * @param {string} version app version for serverInfo
 * @param {AbortSignal} [signal] the request's client went away
 * @returns {Promise<Response | null>}
 */
export async function handleMessage(msg, tools, version, signal) {
  if (!isObject(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(null, -32600, 'Invalid request');
  }
  if (msg.id === undefined) return null;
  if (typeof msg.id !== 'string' && typeof msg.id !== 'number') return rpcError(null, -32600, 'Invalid request: id must be a string or number');
  const { id, method, params = {} } = msg;
  if (!isObject(params)) return rpcError(id, -32602, 'params must be an object');

  if (method === 'initialize') {
    const asked = params.protocolVersion;
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'ai-command-center', version },
      },
    };
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: { tools: [...tools].map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema, ...(t.annotations && { annotations: t.annotations }) })) },
    };
  }
  if (method === 'tools/call') {
    const tool = typeof params.name === 'string' ? tools.get(params.name) : undefined;
    // JSON.stringify, not String(): a JSON object like {"toString":1} makes String() throw.
    if (!tool) return rpcError(id, -32602, `Unknown tool: ${(typeof params.name === 'string' ? params.name : String(JSON.stringify(params.name))).slice(0, 100)}`);
    const args = params.arguments === undefined ? {} : params.arguments;
    if (!isObject(args)) return rpcError(id, -32602, 'arguments must be an object');
    try {
      const out = await tool.run(args, { signal });
      // structuredContent must be a JSON object; anything else goes as text only.
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out ?? null) }], ...(isObject(out) && { structuredContent: out }) } };
    } catch (err) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true } };
    }
  }
  return rpcError(id, -32601, `Method not found: ${method}`);
}

/** @param {unknown} v @returns {v is Record<string, any>} a plain JSON object, not null or an array */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** @param {string | undefined} origin a browser's Origin header; absent for non-browser clients */
export function isLoopbackOrigin(origin) {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(origin || ''));
}

/**
 * @param {string | number | null} id
 * @param {number} code
 * @param {string} message
 * @returns {Response}
 */
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * @param {{ token: string, tools: Map<string, Tool>, version: string, onCall?: (entry: import('./mcplog.js').LogEntry) => void }} opts
 *   onCall hears about every request: answered, failed, or refused before it was read
 * @returns {http.Server} not yet listening
 */
export function createMcpServer({ token, tools, version, onCall = () => {} }) {
  return http.createServer((req, res) => {
    /** @param {number} status @param {unknown} [body] */
    const reply = (status, body) => {
      res.writeHead(status, body === undefined ? {} : { 'Content-Type': 'application/json' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    /** @param {number} status @param {string} reason */
    const refuse = (status, reason) => {
      onCall(refusedCall(status, reason));
      reply(status, { error: reason });
    };
    if (!isLoopbackHost(req.headers.host)) return refuse(403, 'Forbidden host');
    // The transport spec's DNS-rebinding guard: a browser always sends Origin, so a page
    // on any other site is refused even before the token is checked.
    if (req.headers.origin !== undefined && !isLoopbackOrigin(req.headers.origin)) return refuse(403, 'Forbidden origin');
    if (!bearerMatches(req.headers.authorization, token)) return refuse(401, 'Missing or wrong token');
    // Past the token, two refusals are the transport spec's way of steering a client, and
    // are logged as part of the handshake rather than as failures.
    /** @param {number} status @param {string} reason @param {string} note */
    const steer = (status, reason, note) => {
      onCall(expectedCall(status, note));
      reply(status, { error: reason });
    };
    const asked = req.headers['mcp-protocol-version'];
    if (asked !== undefined && !PROTOCOL_VERSIONS.includes(String(asked))) {
      return steer(400, 'Unsupported MCP-Protocol-Version', `Asked for MCP ${String(asked).slice(0, 40)}; told to fall back to ${PROTOCOL_VERSIONS[0]} or older`);
    }
    if (new URL(req.url || '/', 'http://x').pathname !== '/mcp') return refuse(404, 'Not found');
    // No server-to-client stream (GET) and no sessions to end (DELETE).
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      if (req.method === 'GET') return steer(405, 'Method not allowed', 'Asked for an event stream; there is none, so replies come back over POST');
      if (req.method === 'DELETE') return steer(405, 'Method not allowed', 'Asked to end a session; there are none to end');
      return refuse(405, 'Method not allowed');
    }

    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        refuse(413, 'Body too large');
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', async () => {
      if (res.headersSent) return;
      let msg;
      try {
        msg = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        onCall(refusedCall(400, 'Parse error'));
        return reply(400, rpcError(null, -32700, 'Parse error'));
      }
      const started = Date.now();
      // A client that disconnects before the answer (the chat's Stop, a killed CLI)
      // aborts the call, which withdraws a confirm bar it's waiting on.
      const gone = new AbortController();
      res.on('close', () => { if (!res.writableFinished) gone.abort(); });
      /** @type {Response | null} */
      let out;
      try {
        out = await handleMessage(msg, tools, version, gone.signal);
      } catch {
        // Nothing reaching here may leave the socket hanging or the rejection unhandled.
        out = rpcError(isObject(msg) && (typeof msg.id === 'string' || typeof msg.id === 'number') ? msg.id : null, -32603, 'Internal error');
      }
      // Notifications get no answer but still happened.
      try { onCall(describeCall({ msg, out, ms: Date.now() - started })); } catch { /* logging never blocks the reply */ }
      if (out === null) return reply(202);
      reply(200, out);
    });
  });
}
