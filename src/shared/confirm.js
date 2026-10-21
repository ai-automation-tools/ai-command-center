// Questions the app puts to the user on an agent's behalf (terminal_run's click to
// confirm). Each ask gets an id and goes to the shell UI, and it settles exactly once:
// with the user's answer, or with null when nobody answers in time.

/**
 * @template T
 * @typedef {{ resolve: (value: T | null) => void, timer: ReturnType<typeof setTimeout> }} Pending
 */

/** @param {string} p a Windows path, compared case-insensitively and slash-agnostic */
const pathKey = (p) => p.replace(/[\\/]+/g, '\\').replace(/\\$/, '').toLowerCase();

/**
 * Whether an approved terminal_run may type into this terminal: one opened for the
 * ask (created after it was made), PowerShell, still running, and in the folder the
 * confirm bar named. Anything else refuses, so an approval can't land in a shell with
 * half-typed input, a running program, or a different folder.
 * @param {{ id: number, powershell: boolean, exited: boolean, cwd: string } | undefined} t
 * @param {{ sinceId: number, cwd: string }} ask sinceId: the first terminal id not yet used when the ask was made
 */
export function isFreshRunTarget(t, ask) {
  return Boolean(t && t.id >= ask.sinceId && t.powershell && !t.exited && pathKey(t.cwd) === pathKey(ask.cwd));
}

/** @template T */
export class Confirmations {
  /**
   * @param {{ show: (ask: { id: number } & Record<string, unknown>) => void, cancel: (id: number) => void, timeoutMs: number }} opts
   */
  constructor({ show, cancel, timeoutMs }) {
    this.show = show;
    this.cancel = cancel;
    this.timeoutMs = timeoutMs;
    /** @type {Map<number, Pending<T>>} */
    this.pending = new Map();
    this.nextId = 1;
  }

  /**
   * @param {Record<string, unknown>} payload what the UI shows
   * @param {AbortSignal} [signal] the asker went away (its MCP client disconnected, the chat's Stop): withdraw the ask
   * @returns {Promise<T | null>}
   */
  ask(payload, signal) {
    const id = this.nextId++;
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve(null);
      // The UI drops a timed-out or withdrawn ask, so a late click can't act on it.
      const drop = () => { if (this.settle(id, null)) this.cancel(id); };
      const timer = setTimeout(drop, this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      signal?.addEventListener('abort', drop, { once: true });
      this.show({ ...payload, id });
    });
  }

  /**
   * @param {number} id
   * @param {T | null} value
   * @returns {boolean} false when the ask is unknown or already settled
   */
  settle(id, value) {
    const p = this.pending.get(id);
    if (!p) return false;
    this.pending.delete(id);
    clearTimeout(p.timer);
    p.resolve(value);
    return true;
  }
}
