// The Git changes view, read-only: the fixed git command lines the main process runs,
// `git status` parsed into a branch and a file list, and a diff turned into the lines
// of a script-free page. No Electron and no child processes here, so it's all tested.

export const GIT_PREFIX = 'acc://git/';
const MAX_DIFF_LINES = 5000;

/**
 * Settings on every git call so the viewer never runs a program the repo configures:
 * no fsmonitor hook, no external diff or textconv, no pager, and paths as plain UTF-8.
 */
const SAFE = ['-c', 'core.fsmonitor=false', '-c', 'core.quotepath=false', '-c', 'diff.external=', '--no-pager'];

export const ROOT_ARGS = [...SAFE, 'rev-parse', '--show-toplevel'];
export const STATUS_ARGS = [...SAFE, 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'];

/** @typedef {'staged' | 'unstaged' | 'untracked'} DiffArea */
/**
 * @typedef {{ path: string, from: string | null, staged: string | null, unstaged: string | null, kind: 'changed' | 'renamed' | 'conflict' | 'untracked' }} GitFile
 * staged / unstaged: git's one-letter status for that side (M, A, D, R, C, T, U), or null when that side is clean
 */

/**
 * The command line for one file's diff. `path` must come from the status list; it goes
 * after `--`, so it can never be read as an option.
 * @param {DiffArea} area
 * @param {string} path
 */
export function diffArgs(area, path) {
  const base = [...SAFE, 'diff', '--no-color', '--no-ext-diff', '--no-textconv'];
  if (area === 'untracked') return [...base, '--no-index', '--', '/dev/null', path];
  return [...base, ...(area === 'staged' ? ['--cached'] : []), '--', path];
}

/**
 * `git status --porcelain=v2 --branch -z`: the branch, its upstream and how far apart
 * they are, and every changed, renamed, conflicted or untracked file. Ignored files and
 * anything unrecognised are skipped.
 * @param {string} out
 */
export function parseStatus(out) {
  /** @type {{ branch: string, upstream: string | null, ahead: number, behind: number, files: GitFile[] }} */
  const st = { branch: '', upstream: null, ahead: 0, behind: 0, files: [] };
  const parts = out.split('\0');
  const side = (/** @type {string} */ c) => (c === '.' ? null : c);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('# branch.head ')) st.branch = p.slice(14);
    else if (p.startsWith('# branch.upstream ')) st.upstream = p.slice(18);
    else if (p.startsWith('# branch.ab ')) {
      const m = /^\+(\d+) -(\d+)$/.exec(p.slice(12));
      if (m) [st.ahead, st.behind] = [Number(m[1]), Number(m[2])];
    } else if (p.startsWith('1 ')) {
      // 1 XY sub mH mI mW hH hI path
      const f = p.split(' ');
      st.files.push({ path: f.slice(8).join(' '), from: null, staged: side(f[1][0]), unstaged: side(f[1][1]), kind: 'changed' });
    } else if (p.startsWith('2 ')) {
      // 2 XY sub mH mI mW hH hI Xscore path, then the original path as the next field
      const f = p.split(' ');
      st.files.push({ path: f.slice(9).join(' '), from: parts[++i] ?? null, staged: side(f[1][0]), unstaged: side(f[1][1]), kind: 'renamed' });
    } else if (p.startsWith('u ')) {
      // u XY sub m1 m2 m3 mW h1 h2 h3 path
      const f = p.split(' ');
      st.files.push({ path: f.slice(10).join(' '), from: null, staged: null, unstaged: f[1], kind: 'conflict' });
    } else if (p.startsWith('? ')) {
      st.files.push({ path: p.slice(2), from: null, staged: null, unstaged: '?', kind: 'untracked' });
    }
  }
  return st;
}

/**
 * Which diffs a file has: its staged side, its unstaged side, or the whole file when untracked.
 * @param {GitFile} f
 * @returns {DiffArea[]}
 */
export function diffAreas(f) {
  if (f.kind === 'untracked') return ['untracked'];
  return /** @type {DiffArea[]} */ ([f.staged && 'staged', f.unstaged && 'unstaged'].filter(Boolean));
}

/** @param {string} path @param {DiffArea} area */
export function gitUrl(path, area) {
  return `${GIT_PREFIX}${encodeURIComponent(path)}?area=${area}`;
}

/**
 * The file and area an acc://git address names, or null for anything else.
 * @param {string} url
 * @returns {{ path: string, area: DiffArea } | null}
 */
export function gitFromUrl(url) {
  const m = /^acc:\/\/git\/([^?#]+)\?area=(staged|unstaged|untracked)$/i.exec(url);
  if (!m) return null;
  try {
    const path = decodeURIComponent(m[1]);
    return path && !/[\0\r\n]/.test(path) ? { path, area: /** @type {DiffArea} */ (m[2].toLowerCase()) } : null;
  } catch {
    return null;
  }
}

/**
 * A diff as classed lines for the page: added, removed, hunk headers, file headers and
 * context. Capped, with `truncated` saying so.
 * @param {string} diff
 */
export function diffLines(diff) {
  const all = diff.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const lines = all.slice(0, MAX_DIFF_LINES).map((text) => {
    /** @type {'add' | 'del' | 'hunk' | 'meta' | 'ctx'} */
    let cls = 'ctx';
    if (/^(diff --git|index |--- |\+\+\+ |new file mode|deleted file mode|similarity index|rename (from|to) |old mode|new mode|Binary files)/.test(text)) cls = 'meta';
    else if (text.startsWith('@@')) cls = 'hunk';
    else if (text.startsWith('+')) cls = 'add';
    else if (text.startsWith('-')) cls = 'del';
    return { cls, text };
  });
  return { lines, truncated: all.length > MAX_DIFF_LINES };
}
