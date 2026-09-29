// Launch the real app, let it open one page and a terminal, save screenshots, quit.
// Usage: npm run smoke [-- <url>] [--install <id>,<id>]
//        npm run spike:extensions   (installs LastPass and Rakuten, then loads a shop page)
// Screenshots land in .smoke/ (gitignored). Exit code is Electron's.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.smoke');
const args = process.argv.slice(2);
const at = args.indexOf('--install');
const install = at >= 0 ? args.splice(at, 2)[1] : '';
const url = args[0];

const env = { ...process.env, ACC_SMOKE_DIR: dir };
if (url) env.ACC_SMOKE_URL = url;
if (install) { env.ACC_SMOKE_INSTALL = install; env.ACC_SMOKE_WAIT_MS = '25000'; }

const child = spawn(/** @type {string} */ (/** @type {unknown} */ (electron)), ['.'], { cwd: root, stdio: 'inherit', env });
const timer = setTimeout(() => { console.error('[smoke] timed out after 120 s'); child.kill(); }, 120_000);
child.on('exit', (code) => { clearTimeout(timer); process.exit(code ?? 1); });
