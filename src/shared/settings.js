// settings.json in the app's userData folder: the few things that differ from one
// machine to the next. Missing or broken values fall back to neutral defaults, so a
// fresh install needs no file at all. Pure; src/main/store.js reads the file.

export const DEFAULT_HUB_URL = 'http://127.0.0.1:4273';
export const PROJECT_HUB_REPO = 'https://github.com/ai-automation-tools/project-hub';
const MAX_LINKS = 12;
const MAX_LABEL = 40;

/** @typedef {{ hubUrl: string, quickLinks: { label: string, url: string }[] }} Settings */

/**
 * An http(s) URL with no trailing slash, or null.
 * @param {unknown} value
 */
function httpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/**
 * @param {unknown} raw the parsed file, or anything else
 * @param {Record<string, string | undefined>} [env] ACC_HUB_URL wins over the file
 * @returns {Settings}
 */
export function settingsFrom(raw, env = {}) {
  const d = /** @type {Record<string, any>} */ (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
  const hubUrl = httpUrl(env.ACC_HUB_URL) || httpUrl(d.hubUrl) || DEFAULT_HUB_URL;
  /** @type {{ label: string, url: string }[]} */
  const quickLinks = [];
  for (const l of Array.isArray(d.quickLinks) ? d.quickLinks : []) {
    const url = httpUrl(l?.url);
    const label = typeof l?.label === 'string' ? l.label.trim().slice(0, MAX_LABEL) : '';
    if (url && label) quickLinks.push({ label, url });
    if (quickLinks.length === MAX_LINKS) break;
  }
  return {
    hubUrl,
    quickLinks: quickLinks.length ? quickLinks : [
      { label: 'Project Hub', url: hubUrl },
      { label: 'Chrome Web Store', url: 'https://chromewebstore.google.com' },
    ],
  };
}
