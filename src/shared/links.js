// Web addresses in a line of terminal output, so the address a dev server prints opens
// as a tab. Pure; src/renderer/terminal.js hands each buffer line to findLinks() from an
// xterm link provider. Only http(s) and bare loopback hosts with a port; tabs.create
// still checks every URL against isAllowedNavigation().

const LINK = /(?<![\w./@:-])(?:https?:\/\/[^\s<>"'`]+|(?:localhost|127\.0\.0\.1|\[::1\]):\d{1,5}(?:\/[^\s<>"'`]*)?)/gi;
const TRAILING = '.,;:!?\'")]}>';
const PAIRS = { ')': '(', ']': '[', '}': '{' };

/** Drops sentence punctuation after a link, keeping a closing bracket the link opened. */
function trim(text) {
  const count = (/** @type {string} */ ch) => text.split(ch).length - 1;
  while (text && TRAILING.includes(text.at(-1))) {
    const last = text.at(-1);
    if (PAIRS[last] && count(PAIRS[last]) >= count(last)) break;
    text = text.slice(0, -1);
  }
  return text;
}

/**
 * @param {string} line one line of terminal text, escapes already gone
 * @returns {{ text: string, url: string, start: number }[]} start is the 0-based index in the line
 */
export function findLinks(line) {
  if (typeof line !== 'string' || !line) return [];
  const out = [];
  for (const m of line.matchAll(LINK)) {
    const text = trim(m[0]);
    const url = /^https?:\/\//i.test(text) ? text : `http://${text}`;
    try {
      const { protocol, host } = new URL(url);
      if (!/^https?:$/.test(protocol) || !host) continue;
    } catch { continue; }
    out.push({ text, url, start: /** @type {number} */ (m.index) });
  }
  return out;
}
