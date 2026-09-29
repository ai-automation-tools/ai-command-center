// Address-bar input → a URL the browser pane can load. Pure, tested in tests/url.test.js.

const SEARCH = 'https://www.google.com/search?q=';

/**
 * @param {string} input
 * @returns {string}
 */
export function toUrl(input) {
  const text = input.trim();
  if (!text) return 'about:blank';

  // Already a URL with a scheme we allow.
  if (/^(https?|file|chrome-extension):\/\//i.test(text) || /^about:/i.test(text)) return text;

  // A Windows path: D:\x\y.html or D:/x/y.html
  if (/^[a-z]:[\\/]/i.test(text)) return `file:///${text.replace(/\\/g, '/')}`;

  // localhost and loopback, with or without a port.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(text)) return `http://${text}`;

  // Something that looks like a host: no spaces and a dot in the first segment.
  if (!/\s/.test(text) && /^[^/\s]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(text)) return `https://${text}`;

  return SEARCH + encodeURIComponent(text);
}

/**
 * Schemes a page may navigate a tab to. Everything else (javascript:, data:, custom
 * protocol handlers) is refused before it reaches the browser pane.
 * @param {string} url
 */
export function isAllowedNavigation(url) {
  return /^(https?|file|chrome-extension|about):/i.test(url);
}
