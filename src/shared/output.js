// Terminal output as an agent should read it: the escape sequences ConPTY writes
// resolved into plain text, and the last N lines. The main process keeps the raw
// output of each session in a capped buffer.
//
// A one-line cell model: text overwrites from the cursor's column, and the cursor moves
// that PSReadLine uses to redraw the line being typed (absolute column, erase line,
// cursor back) land on that line. ponytail: rows are ignored, so a redraw that moves
// to another row overwrites the current line; a real screen grid would be exact.

export const OUTPUT_MAX_CHARS = 200_000;
export const READ_LINES_MAX = 500;

// CSI with its parameters and final byte, OSC (titles, hyperlinks), other escapes,
// line ends, or a run of plain text.
const TOKEN = /\x1b\[([0-?]*)[ -/]*([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[ -/]*[0-~]|\r|\n|[^\x1b\r\n]+/g;
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f]/g;

/**
 * Raw bytes from the pty as plain text.
 * @param {string} raw
 */
export function cleanOutput(raw) {
  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  let cur = [];
  let col = 0;
  for (const m of raw.matchAll(TOKEN)) {
    const t = m[0];
    if (m[2] !== undefined) {
      const n = m[1].split(';').map((p) => Number(p) || 0);
      if (m[2] === 'H' || m[2] === 'f') col = Math.max(0, (n[1] || 1) - 1);
      else if (m[2] === 'G') col = Math.max(0, (n[0] || 1) - 1);
      else if (m[2] === 'C') col += n[0] || 1;
      else if (m[2] === 'D') col = Math.max(0, col - (n[0] || 1));
      else if (m[2] === 'K') {
        if (n[0] === 2) cur = [];
        else if (n[0] === 1) cur.fill(' ', 0, Math.min(col, cur.length));
        else cur.length = Math.min(cur.length, col);
      }
    } else if (t === '\r') col = 0;
    else if (t === '\n') { lines.push(cur.join('')); cur = []; col = 0; }
    else if (t[0] !== '\x1b') {
      for (const ch of t.replace(CONTROL, '')) {
        while (cur.length < col) cur.push(' ');
        cur[col++] = ch;
      }
    }
  }
  lines.push(cur.join(''));
  return lines.join('\n');
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
