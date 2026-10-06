// Terminal output as an agent should read it: the escape sequences ConPTY writes
// stripped out, carriage returns resolved, control characters dropped, and the last N
// lines. The main process keeps the raw output of each session in a capped buffer.

export const OUTPUT_MAX_CHARS = 200_000;
export const READ_LINES_MAX = 500;

// CSI (colours, cursor moves, erases), OSC (titles, hyperlinks), and the two-byte
// escapes in between, in that order so the longer forms win.
const ESCAPES = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[ -/]*[0-~]/g;
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/g;
// "Cursor to column 1" (CSI G, CSI n;1H, CSI H) and "erase the line" (CSI 2K) are how
// PSReadLine redraws the line being typed; treating them as \r keeps the final redraw.
const LINE_START = /\x1b\[(?:\d+;)?1?[GH]|\x1b\[2K/g;

/**
 * Raw bytes from the pty as plain text.
 * @param {string} raw
 */
export function cleanOutput(raw) {
  return raw
    .replace(LINE_START, '\r')
    .replace(ESCAPES, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    // ponytail: a bare \r means "overwrite from column 0" (progress bars, spinners);
    // keeping what came after it is close enough, a real cell grid would be exact.
    .map((line) => line.split('\r').pop() ?? '')
    .join('\n')
    .replace(CONTROL, '');
}

/**
 * The last `n` lines of cleaned text, trailing blank lines dropped.
 * @param {string} text
 * @param {number} n
 */
export function lastLines(text, n) {
  const lines = text.split('\n');
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.slice(-n).join('\n');
}

/**
 * The buffer with `data` appended, keeping only the newest `max` characters.
 * @param {string} buffer
 * @param {string} data
 * @param {number} [max]
 */
export function appendOutput(buffer, data, max = OUTPUT_MAX_CHARS) {
  const next = buffer + data;
  return next.length > max ? next.slice(-max) : next;
}
