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
  if (/^(https?|file|chrome-extension):\/\//i.test(text) || /^about:/i.test(text) || /^acc:\/\/(doc|run)\//i.test(text)) return text;

  // A Windows path: D:\x\y.html or D:/x/y.html
  if (/^[a-z]:[\\/]/i.test(text)) return `file:///${text.replace(/\\/g, '/')}`;

  // localhost and loopback, with or without a port.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(text)) return `http://${text}`;

  // Something that looks like a host: no spaces and a dot in the first segment.
  if (!/\s/.test(text) && /^[^/\s]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(text)) return `https://${text}`;

  return SEARCH + encodeURIComponent(text);
}

/**
 * Schemes a tab may be sent to. Everything else (javascript:, data:, custom protocol
 * handlers, the shell's acc://shell) is refused before it reaches the browser pane.
 * Command Center's document pages (acc://doc) open from the app itself, with no `from`,
 * or from another document page; a web page can't navigate to one. A Cronsole run's
 * output (acc://run) opens from the app only.
 * @param {string} url
 * @param {string} [from] URL of the page asking, when a page asks
 */
export function isAllowedNavigation(url, from = '') {
  if (/^acc:\/\/doc\//i.test(url)) return !from || /^acc:\/\/doc\//i.test(from);
  if (/^acc:\/\/run\//i.test(url)) return !from;
  return /^(https?|file|chrome-extension|about):/i.test(url);
}
