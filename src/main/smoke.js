// `npm run smoke`: the end-to-end run scripts/smoke.js drives. Kept out of main.js so
// the main process stays thin; main.js calls it only when ACC_SMOKE_DIR is set.
// Each observation is a named check. Checks that need Project Hub or Cronsole count only
// with ACC_SMOKE_LIVE=1 (npm run smoke -- --live); without it they're reported, not
// failed. The verdict goes to <dir>/summary.json and the process exit code.

import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installExtension } from 'electron-chrome-web-store';
import { listExtensions } from './extensions.js';

/** @typedef {import('./tabs.js').Tabs} Tabs */
/** @typedef {import('./terminal.js').Terminals} Terminals */

/**
 * `npm run smoke`: forward the shell's console to stdout, open one page, and save
 * screenshots of the shell and the page, then quit. See scripts/smoke.js.
 * @param {string} dir
 * @param {Electron.WebContents} wc the shell view's webContents
 * @param {Tabs} tabs
 * @param {Terminals} terminals
 * @param {Electron.Session} browseSession
 */
export function smoke(dir, wc, tabs, terminals, browseSession) {
  const live = process.env.ACC_SMOKE_LIVE === '1';
  /** @type {{ name: string, result: 'pass' | 'fail' | 'skip' | 'warn', detail?: string }[]} */
  const results = [];
  /**
   * @param {string} name
   * @param {unknown} ok
   * @param {unknown} [detail]
   * @param {{ live?: boolean, warnOnly?: boolean }} [opts] live: needs Hub or Cronsole; warnOnly: flaky, never fails the run
   */
  const check = (name, ok, detail, { live: needsLive = false, warnOnly = false } = {}) => {
    const result = ok ? 'pass' : warnOnly ? 'warn' : needsLive && !live ? 'skip' : 'fail';
    results.push({ name, result, ...(detail !== undefined && { detail: String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300) }) });
    console.log(`[smoke] ${result.toUpperCase()} ${name}${ok ? '' : ` (${String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 200)})`}`);
  };
  /** A screenshot, which can fail on a hidden or locked display; never fails the run. @param {string} file @param {Electron.WebContents} from */
  const shot = async (file, from) => {
    try {
      fs.writeFileSync(path.join(dir, file), (await from.capturePage()).toPNG());
    } catch (err) {
      check(`screenshot ${file}`, false, err instanceof Error ? err.message : err, { warnOnly: true });
    }
  };
  const finish = () => {
    const failed = results.filter((r) => r.result === 'fail').length;
    const summary = { live, passed: results.filter((r) => r.result === 'pass').length, failed, skipped: results.filter((r) => r.result === 'skip').length, warnings: results.filter((r) => r.result === 'warn').length, checks: results };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(`[smoke] ${failed ? 'FAILED' : 'passed'}: ${summary.passed} passed, ${failed} failed, ${summary.skipped} skipped (live checks need --live), ${summary.warnings} warnings. ${path.join(dir, 'summary.json')}`);
    process.exitCode = failed ? 1 : 0;
    app.quit();
  };
  wc.on('console-message', (e) => console.log(`[shell:${e.level}] ${e.message}`));
  wc.on('preload-error', (_e, p, err) => console.log(`[shell:preload-error] ${p}: ${err.message}`));
  // Extension service workers log here, not to any page; the extension spike needs it.
  browseSession.serviceWorkers.on('console-message', (_e, d) => console.log(`[sw:${d.level}] ${d.sourceUrl}:${d.lineNumber} ${String(d.message).slice(0, 300)}`));
  wc.once('did-finish-load', async () => {
    try {
      await run();
    } catch (err) {
      check('the run finished', false, err instanceof Error ? err.stack || err.message : err);
    }
    finish();
  });

  async function run() {
    const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
    await wait(4000);
    // ACC_SMOKE_INSTALL=<id>,<id>: install Web Store extensions first (the extension spike).
    for (const id of (process.env.ACC_SMOKE_INSTALL || '').split(',').filter(Boolean)) {
      try {
        const ext = await installExtension(id, { session: browseSession });
        console.log(`[smoke] installed ${id}: ${ext?.name} ${ext?.version} (MV${ext?.manifest?.manifest_version})`);
      } catch (err) {
        console.log(`[smoke] install ${id} FAILED: ${err instanceof Error ? err.message : err}`);
      }
    }
    const tab = tabs.create(process.env.ACC_SMOKE_URL || 'https://example.com');
    await wait(Number(process.env.ACC_SMOKE_WAIT_MS || 16000));
    // Drive the sidebar the way a person would: expand the first root, then search.
    const checks = await wc.executeJavaScript(`(async () => {
      const first = document.querySelector('#panel-files .row');
      first?.click();
      const expanded = document.querySelectorAll('#panel-files .row').length;
      const s = document.getElementById('search');
      s.value = 'README';
      s.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 500));
      const results = document.querySelectorAll('#panel-search .row').length;
      const groups = [...document.querySelectorAll('#panel-search .group-title')].map((g) => g.textContent);
      const terminals = document.querySelectorAll('.term-tab').length;
      return { expandedRows: expanded, searchResults: results, groups, terminals, hubDot: document.getElementById('hub-status').className };
    })()`);
    console.log(`[smoke] shell checks=${JSON.stringify(checks)}`);
    check('a terminal opened at start', checks.terminals >= 1, checks);
    check('Hub: the Files tree loads and expands', checks.expandedRows > 1 && /ok/.test(checks.hubDot), checks, { live: true });
    check('Hub: the search box finds README files', checks.searchResults > 0, checks, { live: true });
    fs.mkdirSync(dir, { recursive: true });
    await shot('tab.png', tab.view.webContents);
    console.log(`[smoke] tab url=${tab.view.webContents.getURL()} title=${tab.view.webContents.getTitle()}`);
    if (!process.env.ACC_SMOKE_URL) check('a tab loads example.com', /^https:\/\/example\.com/.test(tab.view.webContents.getURL()) && /Example/.test(tab.view.webContents.getTitle()), tab.view.webContents.getURL());
    console.log(`[smoke] tab bounds=${JSON.stringify(tab.view.getBounds())}`);
    console.log(`[smoke] extensions=${JSON.stringify(listExtensions(browseSession))}`);
    // The MCP server as a client would find it: no token must fail, the file's token must work.
    try {
      const { url, token } = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'mcp.json'), 'utf8'));
      const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
      const without = (await fetch(url, { method: 'POST', body })).status;
      const withToken = (await fetch(url, { method: 'POST', body, headers: { Authorization: `Bearer ${token}` } })).status;
      console.log(`[smoke] mcp ${url} without-token=${without} with-token=${withToken}`);
      check('MCP refuses a call without the token and answers with it', without === 401 && withToken === 200, { without, withToken });
      const call = (/** @type {string} */ name, /** @type {object} */ args) => fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }),
      }).then((r) => r.json()).then((r) => r.result?.structuredContent ?? r);
      const opened = await call('open_tab', { url: 'example.org', background: true });
      console.log(`[smoke] mcp open_tab=${JSON.stringify(opened)}`);
      check('open_tab opens a tab', Number.isInteger(opened?.id) && /example\.org/.test(opened?.url), opened);
      const listed = await call('list_tabs', {});
      const found = await call('sidebar_search', { query: 'README', limit: 5 });
      const recent = await call('recent', { limit: 3 });
      console.log(`[smoke] mcp list_tabs=${JSON.stringify(listed)}`);
      check('list_tabs lists the opened tab', listed?.tabs?.some((/** @type {any} */ t) => t.id === opened?.id), listed);
      check('sidebar_search answers', Array.isArray(found?.bookmarks) && Array.isArray(found?.recent), found?.errors);
      check('Hub: sidebar_search finds files', found?.files?.length > 0, found?.errors, { live: true });
      console.log(`[smoke] mcp sidebar_search files=${found.files?.length} bookmarks=${found.bookmarks?.length} recent=${found.recent?.length} errors=${JSON.stringify(found.errors)}`);
      console.log(`[smoke] mcp recent items=${recent.items?.length}`);
      // terminal_run waits on the confirm bar; click Run the way a person would.
      // Prints the URL the terminal was given, so shell.png shows ACC_MCP_URL arrived.
      const ran = call('terminal_run', { command: 'Write-Output "acc-smoke $env:ACC_MCP_URL"' });
      await wait(500);
      const shown = await wc.executeJavaScript(`(() => {
        const bar = document.getElementById('confirm-bar');
        const text = bar.hidden ? null : document.getElementById('confirm-cmd').textContent;
        document.getElementById('confirm-run').click();
        return text;
      })()`);
      const ranOut = await ran;
      console.log(`[smoke] mcp terminal_run bar=${JSON.stringify(shown)} result=${JSON.stringify(ranOut)}`);
      check('terminal_run shows the exact command on the bar and runs on Run', shown === 'Write-Output "acc-smoke $env:ACC_MCP_URL"' && ranOut?.ran === true, { shown, ranOut });
      // The loop closed: the terminal's output and the page's text, read back.
      await wait(1500);
      const sessions = await call('list_terminals', {});
      const output = await call('terminal_read', { lines: 5 });
      console.log(`[smoke] mcp list_terminals=${JSON.stringify(sessions)}`);
      console.log(`[smoke] mcp terminal_read terminal=${output.terminal} text=${JSON.stringify(output.text?.slice(-200))}`);
      check('terminal_read reads back what the command printed, with the MCP address it was given', output.terminal === ranOut?.terminal && /acc-smoke http:\/\/127\.0\.0\.1:\d+\/mcp/.test(output.text || ''), output.text?.slice(-200));
      check('list_terminals shows the new terminal as active', sessions?.terminals?.some((/** @type {any} */ s) => s.id === ranOut?.terminal && s.active), sessions);
      console.log(`[smoke] terminal raw tail=${JSON.stringify(terminals.read()?.raw?.slice(-400))}`);
      const page = await call('read_tab', { tab: tab.view.webContents.id });
      console.log(`[smoke] mcp read_tab title=${JSON.stringify(page.title)} chars=${page.text?.length} truncated=${page.truncated} start=${JSON.stringify(page.text?.slice(0, 60))}`);
      if (!process.env.ACC_SMOKE_URL) check('read_tab reads the page text', /Example Domain/.test(page.title || '') && page.text?.length > 0, page.title);
      // cron_tasks answers with the list, or says what to set when Cronsole isn't configured.
      const cronOut = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'cron_tasks', arguments: {} } }),
      }).then((r) => r.json());
      console.log(`[smoke] mcp cron_tasks tasks=${cronOut.result?.structuredContent?.tasks?.length ?? null} error=${JSON.stringify(cronOut.result?.isError ? cronOut.result.content?.[0]?.text?.slice(0, 80) : null)}`);
      check('cron_tasks answers with a list or says what to set', Array.isArray(cronOut.result?.structuredContent?.tasks) || cronOut.result?.isError === true, cronOut.error);
      check('Cronsole: cron_tasks lists tasks', cronOut.result?.structuredContent?.tasks?.length > 0, cronOut.result?.content?.[0]?.text?.slice(0, 120), { live: true });
      // Find in page on example.com: type a word and read the match count.
      tabs.activate(tab.id);
      const finder = await wc.executeJavaScript(`(async () => {
        document.getElementById('find-form').hidden = false;
        const i = document.getElementById('find-input');
        i.value = 'domain';
        i.dispatchEvent(new Event('input'));
        await new Promise((r) => setTimeout(r, 800));
        const count = document.getElementById('find-count').textContent;
        document.getElementById('find-close').click();
        return { count, hidden: document.getElementById('find-form').hidden };
      })()`);
      console.log(`[smoke] find=${JSON.stringify(finder)}`);
      if (!process.env.ACC_SMOKE_URL) check('find in page counts matches and closes', /^[1-9]\d*\/[1-9]\d*$/.test(finder.count) && finder.hidden, finder);
    } catch (err) {
      check('the MCP checks ran', false, err instanceof Error ? err.message : err);
    }
    // The shell menu's profiles, a non-PowerShell session, and a Files click landing
    // on a document page (the right-click menu itself is native and needs a person).
    const shellChecks = await wc.executeJavaScript(`(async () => {
      const shells = (await window.acc.info()).shells.map((s) => s.id);
      const cmd = await window.acc.term.create({ shell: 'cmd' });
      await window.acc.term.kill(cmd.id);
      const md = [...document.querySelectorAll('#panel-search .row')].find((r) => /\\.md$/i.test(r.querySelector('.name')?.textContent || ''));
      md?.click();
      return { shells, cmd: [cmd.shell, cmd.powershell], clicked: md?.querySelector('.name')?.textContent ?? null };
    })()`);
    // Hub renders the file first; give it up to 10 s rather than a fixed wait.
    for (let i = 0; i < 40 && !tabs.list().some((t) => t.url.startsWith('acc://doc/')); i++) await wait(250);
    await wait(1000);
    console.log(`[smoke] shells=${JSON.stringify(shellChecks)} tabs=${JSON.stringify(tabs.list().map((t) => t.url))}`);
    check('the shell menu offers PowerShell 7, and Command Prompt starts as not-PowerShell', shellChecks.shells.includes('pwsh') && shellChecks.cmd[1] === false, shellChecks);
    const doc = tabs.list().find((t) => t.url.startsWith('acc://doc/'));
    const docTab = doc && tabs.tabs.get(doc.id);
    if (docTab) {
      const page = await docTab.view.webContents.executeJavaScript(
        `({ title: document.title, headings: document.querySelectorAll('h1, h2').length, images: [...document.images].map((i) => [i.src.slice(0, 60), i.naturalWidth]).slice(0, 3), sidebar: Boolean(document.querySelector('aside, nav#sidebar')) })`);
      console.log(`[smoke] doc page=${JSON.stringify(page)}`);
      check('Hub: a Markdown file opens as a document page without a second sidebar', page.headings > 0 && !page.sidebar, page, { live: true });
      await shot('doc.png', docTab.view.webContents);
    } else {
      check('Hub: a Markdown file opens as a document page', false, 'no acc://doc tab', { live: true });
    }
    // The MCP calls above, in the sidebar's MCP panel and at the end of mcp.log.
    const panel = await wc.executeJavaScript(`[...document.querySelectorAll('#panel-mcp .row .name')].map((n) => n.textContent.split(' ')[0]).slice(0, 8)`);
    const logged = fs.readFileSync(path.join(app.getPath('userData'), 'logs', 'mcp.log'), 'utf8').trim().split('\n').slice(-8)
      .map((l) => { const e = JSON.parse(l); return `${e.tool || e.method}:${e.ok ? 'ok' : e.status || 'err'}`; });
    console.log(`[smoke] mcp log panel=${JSON.stringify(panel)} file=${JSON.stringify(logged)}`);
    check('MCP calls show in the panel and in mcp.log', panel.includes('terminal_run') && logged.some((/** @type {string} */ l) => l.startsWith('terminal_run:')), { panel, logged });
    // The Chat tab: what it tells the user (model and missing variables only; the key never leaves main).
    const chatPanel = await wc.executeJavaScript(`(async () => {
      const s = document.getElementById('search');
      s.value = '';
      s.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 300));
      document.querySelector('.side-tabs [data-panel="chat"]').click();
      const page = document.getElementById('chat-attach-page');
      page.click();
      const attach = page.getAttribute('aria-pressed');
      page.click();
      return { info: await window.acc.chat.info(), attach, shown: document.getElementById('chat-log').textContent.slice(0, 160) };
    })()`);
    console.log(`[smoke] chat=${JSON.stringify(chatPanel)}`);
    check('the Chat tab opens, toggles + page, and never gets the key', chatPanel.attach === 'true' && Array.isArray(chatPanel.info?.missing) && !('apiKey' in (chatPanel.info || {})), chatPanel.info);
    // The Cron tab (Cronsole's tasks through its MCP server, when ACC_CRONSOLE_MCP is set):
    // the first task with recorded runs unfolds them and its newest opens as an acc://run
    // page; then Open Cronsole twice: one pinned tab, first in the strip, reused.
    const cronPanel = await wc.executeJavaScript(`(async () => {
      document.querySelector('.side-tabs [data-panel="cron"]').click();
      for (let i = 0; i < 60 && /Asking/.test(document.getElementById('cron-list').textContent); i++) await new Promise((r) => setTimeout(r, 500));
      const rows = [...document.querySelectorAll('#cron-list .row.task')];
      let runs = [];
      let runsNote = null;
      for (const row of rows.filter((r) => /Last run:/.test(r.title)).slice(0, 8)) {
        row.click();
        for (let i = 0; i < 40 && /Asking/.test(row.nextElementSibling?.textContent || ''); i++) await new Promise((r) => setTimeout(r, 250));
        runs = [...(row.nextElementSibling?.querySelectorAll('.row.run') || [])];
        if (runs.length) break;
        runsNote ??= row.nextElementSibling?.textContent.slice(0, 120) ?? null;
        row.click();
      }
      runs[0]?.click();
      await new Promise((r) => setTimeout(r, 2000));
      document.getElementById('cron-open').click();
      await new Promise((r) => setTimeout(r, 1500));
      document.getElementById('cron-open').click();
      await new Promise((r) => setTimeout(r, 500));
      const pinned = document.querySelectorAll('#tab-list .tab.pinned');
      return {
        info: await window.acc.cronsole.info(),
        tasks: rows.length,
        first: rows.slice(0, 3).map((r) => r.querySelector('.name').textContent + ' · ' + r.querySelector('.sub').textContent),
        note: rows.length ? null : document.getElementById('cron-list').textContent.slice(0, 200),
        runs: runs.slice(0, 2).map((r) => r.querySelector('.name').textContent),
        runsNote: runs.length ? null : runsNote,
        pinnedTabs: pinned.length,
        pinnedFirst: document.querySelector('#tab-list .tab') === pinned[0],
      };
    })()`);
    console.log(`[smoke] cronsole=${JSON.stringify(cronPanel)} tabs=${JSON.stringify(tabs.list().map((t) => t.url))}`);
    check('Cronsole: the Cron tab lists tasks and Open Cronsole keeps one pinned tab first', cronPanel.tasks > 0 && cronPanel.pinnedTabs === 1 && cronPanel.pinnedFirst, cronPanel.note ?? cronPanel.info, { live: true });
    const run = tabs.list().find((t) => t.url.startsWith('acc://run/'));
    const runTab = run && tabs.tabs.get(run.id);
    if (runTab) {
      const page = await runTab.view.webContents.executeJavaScript(
        `({ title: document.title, facts: document.querySelector('.note')?.textContent, output: document.querySelector('pre')?.textContent.length ?? null, none: /no output/.test(document.body.textContent) })`);
      console.log(`[smoke] run page=${JSON.stringify(page)}`);
      check('Cronsole: a run opens as a page', Boolean(page.title), page, { live: true });
    }
    // A workspace round trip: its own tabs and terminal, and everything back on return.
    const spaceRun = await wc.executeJavaScript(`(async () => {
      const pause = () => new Promise((r) => setTimeout(r, 2500));
      const seen = () => ({
        tabs: document.querySelectorAll('#tab-list .tab').length,
        terms: [...document.querySelectorAll('#term-tabs .term-tab')].filter((t) => !t.hidden).map((t) => t.title),
      });
      const before = seen();
      const added = await window.acc.workspace.add({ folder: ${JSON.stringify(os.tmpdir())}, name: 'Smoke space' });
      await pause();
      const inside = { active: added.active, ...seen(), button: document.getElementById('workspace').textContent };
      await window.acc.workspace.switch('default');
      await pause();
      const back = seen();
      const left = (await window.acc.workspace.remove(added.active)).list.length;
      return { before, inside, back, left };
    })()`);
    console.log(`[smoke] workspace=${JSON.stringify(spaceRun)} sessions=${terminals.listSessions().length}`);
    check('a workspace switch swaps the tabs and terminals, and switching back restores them',
      spaceRun.inside.active === 'smoke-space' && spaceRun.inside.tabs === 0 && spaceRun.inside.terms.length === 1 && spaceRun.inside.terms[0] === os.tmpdir()
      && /Smoke space/.test(spaceRun.inside.button) && spaceRun.back.tabs === spaceRun.before.tabs
      && spaceRun.back.terms.length === spaceRun.before.terms.length && spaceRun.left === 1
      && terminals.listSessions().length === spaceRun.before.terms.length + 1, spaceRun);
    // Last, so it shows terminal_run's output in the terminal.
    await wait(1500);
    await shot('shell.png', wc);
    console.log(`[smoke] screenshots in ${dir}`);
  }
}
