// The Control Center MCP server: JSON-RPC over MCP's Streamable HTTP transport, plain
// JSON responses only (no SSE stream, no sessions). No Electron here, so tests can run
// it for real; src/main/mcp.js starts it and hands it the tools.
//
// Every request must carry `Authorization: Bearer <token>` and a loopback Host header
// (the Host check stops DNS rebinding from a web page reaching the port).

import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const MAX_BODY = 1024 * 1024;

/**
 * @typedef {{ description: string, inputSchema: object, run: (args: any) => unknown }} Tool
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
 * @returns {Promise<Response | null>}
 */
export async function handleMessage(msg, tools, version) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(null, -32600, 'Invalid request');
  }
  if (msg.id === undefined) return null;
  const { id, method, params = {} } = msg;

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
      result: { tools: [...tools].map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) },
    };
  }
  if (method === 'tools/call') {
    const tool = tools.get(params.name);
    if (!tool) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
    try {
      const out = await tool.run(params.arguments ?? {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out ?? null) }], structuredContent: out ?? null } };
    } catch (err) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true } };
    }
  }
  return rpcError(id, -32601, `Method not found: ${method}`);
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
 * @param {{ token: string, tools: Map<string, Tool>, version: string }} opts
 * @returns {http.Server} not yet listening
 */
export function createMcpServer({ token, tools, version }) {
  return http.createServer((req, res) => {
    /** @param {number} status @param {unknown} [body] */
    const reply = (status, body) => {
      res.writeHead(status, body === undefined ? {} : { 'Content-Type': 'application/json' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    if (!isLoopbackHost(req.headers.host)) return reply(403, { error: 'Forbidden host' });
    if (!bearerMatches(req.headers.authorization, token)) return reply(401, { error: 'Missing or wrong token' });
    if (new URL(req.url || '/', 'http://x').pathname !== '/mcp') return reply(404, { error: 'Not found' });
    // No server-to-client stream (GET) and no sessions to end (DELETE).
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return reply(405, { error: 'Method not allowed' });
    }

    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reply(413, { error: 'Body too large' });
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', async () => {
      if (res.headersSent) return;
      let msg;
      try {
        msg = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reply(400, rpcError(null, -32700, 'Parse error'));
      }
      const out = await handleMessage(msg, tools, version);
      if (out === null) return reply(202);
      reply(200, out);
    });
  });
}
