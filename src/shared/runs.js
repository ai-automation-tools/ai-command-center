// Managed runs: each terminal_run is one command in its own PowerShell session, and the
// session's exit code is the run's result. Nothing reads the output to decide whether it
// worked. Pure; the main process starts the sessions (src/main/terminal.js) and keeps
// one Runs for the app.

import { appendOutput } from './output.js';

export const RUNS_KEEP = 50;
/** Output kept per finished run, newest characters. */
export const RUN_OUTPUT_MAX = 50_000;

/**
 * The fixed script a run's PowerShell starts with (`-Command`). The command itself comes
 * in ACC_RUN_COMMAND, which the script reads and removes, so it never becomes a shell
 * argument and the command's own programs don't inherit it. It prints the command, runs
 * it in the session's scope, and exits with:
 *  - the code `exit N` gives, or 1 for a parse error or anything thrown;
 *  - else the last native program's exit code when it isn't 0;
 *  - else 1 if any PowerShell error was written, else 0.
 * The same in PowerShell 7 and Windows PowerShell 5.1.
 */
export const RUN_SCRIPT = [
  '$c = $env:ACC_RUN_COMMAND; Remove-Item Env:ACC_RUN_COMMAND',
  'Write-Host "> $c" -ForegroundColor DarkGray',
  '$global:LASTEXITCODE = 0; $Error.Clear()',
  'try { . ([scriptblock]::Create($c)) } catch { Write-Host $_ -ForegroundColor Red; exit 1 }',
  'exit $(if ($LASTEXITCODE) { $LASTEXITCODE } elseif ($Error.Count) { 1 } else { 0 })',
].join('; ');

/**
 * @typedef {'running' | 'succeeded' | 'failed' | 'cancelled'} RunState
 * @typedef {{ run: number, terminal: number, command: string, cwd: string, state: RunState, exitCode: number | null, startedAt: number, endedAt: number | null, output: string | null }} Run
 *   output: kept once it ends; while it runs, the terminal's buffer is the output
 */

export class Runs {
  constructor() {
    /** @type {Run[]} oldest first */
    this.list = [];
    this.nextId = 1;
  }

  /** @param {{ terminal: number, command: string, cwd: string }} p @returns {Run} */
  start({ terminal, command, cwd }, at = Date.now()) {
    const r = /** @type {Run} */ ({ run: this.nextId++, terminal, command, cwd, state: 'running', exitCode: null, startedAt: at, endedAt: null, output: null });
    this.list.push(r);
    // Forget the oldest finished runs past the cap; a running one stays.
    while (this.list.length > RUNS_KEEP) {
      const i = this.list.findIndex((x) => x.state !== 'running');
      if (i < 0) break;
      this.list.splice(i, 1);
    }
    return r;
  }

  /** @param {number} [id] the newest run when left out */
  get(id) {
    return id === undefined ? this.list.at(-1) : this.list.find((r) => r.run === id);
  }

  /** @param {number} terminal */
  running(terminal) {
    return this.list.find((r) => r.terminal === terminal && r.state === 'running');
  }

  /**
   * The run's session exited: its code decides the result.
   * @param {number} terminal @param {number} exitCode @param {string | undefined} output
   */
  end(terminal, exitCode, output, at = Date.now()) {
    const r = this.running(terminal);
    if (r) Object.assign(r, { state: exitCode === 0 ? 'succeeded' : 'failed', exitCode, endedAt: at, output: keep(output) });
    return r;
  }

  /**
   * The user closed the run's terminal before it ended. There is no exit code to report.
   * @param {number} terminal @param {string | undefined} output
   */
  cancel(terminal, output, at = Date.now()) {
    const r = this.running(terminal);
    if (r) Object.assign(r, { state: 'cancelled', endedAt: at, output: keep(output) });
    return r;
  }
}

/** @param {string | undefined} raw */
const keep = (raw) => appendOutput('', raw ?? '', RUN_OUTPUT_MAX);

/**
 * What run_status reports, without the output, which the tool cleans and trims.
 * @param {Run} r
 */
export function runInfo(r, now = Date.now()) {
  const { output, ...rest } = r;
  return { ...rest, durationMs: (r.endedAt ?? now) - r.startedAt };
}
