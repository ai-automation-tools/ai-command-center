// Ad and tracker blocking for the browse session: Ghostery's engine (MPL-2.0) with its
// prebuilt EasyList/EasyPrivacy build. Web Store ad blockers can't do this here: they're
// MV3 and filter through declarativeNetRequest, which Electron doesn't have (ADR-001).
// While on, it owns the session's webRequest onBeforeRequest and onHeadersReceived.
// Electron allows one listener per event, so nothing else in the app may use them.

import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The engine, from the cached copy in userData or, if that's missing or a week old, downloaded fresh. */
export async function loadBlocker() {
  const cache = path.join(app.getPath('userData'), 'adblock-engine.bin');
  // The library keeps a cached engine forever; dropping it weekly picks up new filter lists.
  const age = await fs.stat(cache).then((s) => Date.now() - s.mtimeMs, () => Infinity);
  if (age > MAX_AGE_MS) await fs.rm(cache, { force: true });
  return ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
    path: cache,
    read: fs.readFile,
    write: fs.writeFile,
  });
}
