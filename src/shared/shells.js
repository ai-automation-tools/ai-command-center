// The shells the terminal panel can start. Each profile is a fixed executable with
// fixed arguments; the renderer names a profile and nothing else, so no message can
// start a shell with chosen arguments (CLAUDE.md's terminal rule).

import path from 'node:path';

const join = path.win32.join;

/**
 * @typedef {{ id: string, label: string, file: string, args: string[], powershell: boolean }} Shell
 */

/**
 * The shells installed on this machine, PowerShell 7 first when it's there.
 * @param {Record<string, string | undefined>} env process.env
 * @param {(file: string) => boolean} exists
 * @returns {Shell[]}
 */
export function shellProfiles(env, exists) {
  const pf = env.ProgramFiles || 'C:/Program Files';
  const win = env.SystemRoot || 'C:/Windows';
  const candidates = [
    { id: 'pwsh', label: 'PowerShell 7', files: [join(pf, 'PowerShell/7/pwsh.exe')], args: ['-NoLogo'], powershell: true },
    { id: 'powershell', label: 'Windows PowerShell', files: [join(win, 'System32/WindowsPowerShell/v1.0/powershell.exe')], args: ['-NoLogo'], powershell: true },
    { id: 'cmd', label: 'Command Prompt', files: [join(win, 'System32/cmd.exe')], args: [], powershell: false },
    {
      id: 'git-bash',
      label: 'Git Bash',
      files: [join(pf, 'Git/bin/bash.exe'), ...(env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'Programs/Git/bin/bash.exe')] : [])],
      args: ['--login', '-i'],
      powershell: false,
    },
  ];
  /** @type {Shell[]} */
  const found = [];
  for (const { files, ...rest } of candidates) {
    const file = files.find(exists);
    if (file) found.push({ ...rest, file });
  }
  // Nothing at the usual paths: let Windows find PowerShell on PATH.
  return found.length ? found : [{ id: 'powershell', label: 'Windows PowerShell', file: 'powershell.exe', args: ['-NoLogo'], powershell: true }];
}

/**
 * The profile a terminal asks for by id, or the default (the first) for anything else.
 * @param {Shell[]} profiles
 * @param {unknown} id
 */
export function pickShell(profiles, id) {
  return profiles.find((p) => p.id === id) || profiles[0];
}
