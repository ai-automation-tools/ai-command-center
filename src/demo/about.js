// The demo's welcome page: what AI Command Center is, shown in the first tab as the
// app's README would be. Static HTML, no scripts, no network. Keep it in step with the
// README's "What works today" table when a feature lands.

import { docUrl } from '../shared/docs.js';
import { REPO_URL } from './page.js';

export const WELCOME_ID = 'ai-command-center/README.md';
export const WELCOME_URL = docUrl(WELCOME_ID);

export const ABOUT_HTML = `<article class="demo-doc">
  <h1>AI Command Center</h1>
  <p class="lede">One window for the browser, PowerShell terminals and every project folder you work in, with an agent harness that lets Claude drive it. A Windows desktop app built on Electron.</p>

  <p>The sidebar comes from <a href="https://github.com/ai-automation-tools/project-hub" target="_blank" rel="noopener">Project Hub</a>, a small local server that scans your workspaces and reads your browser bookmarks. An MCP server and a chat panel let an agent, Claude Code in one of the app's terminals or Claude in the sidebar, open tabs and files, read what a page or a terminal shows, and run commands you approve with a click.</p>

  <h2>Try it here</h2>
  <p>This is the app's real shell UI with made-up files, bookmarks and terminal output. Nothing runs and nothing leaves your browser.</p>
  <ul>
    <li><b>Terminal:</b> type <code>npm test</code>, <code>git status</code> or <code>ls</code> in the panel below.</li>
    <li><b>Confirm bar:</b> a few seconds in, an agent asks to run <code>npm test</code>. Click <b>Run</b> and watch it land in the terminal.</li>
    <li><b>Sidebar:</b> browse Files and Bookmarks, search across both, and open the <b>MCP</b>, <b>Chat</b> and <b>Cron</b> tabs.</li>
    <li><b>Tabs:</b> type an address and press Enter. The tab strip, back and forward, and Recent all work; the demo just has no browser engine behind the page.</li>
  </ul>

  <h2>What it does</h2>
  <table>
    <tr><th>🌐 Browser</th><td>Tabs, an address bar that takes URLs, <code>D:\\</code> paths, <code>localhost</code> or a search, links and pop-ups as tabs, and Chrome Web Store installs in a tab.</td></tr>
    <tr><th>💻 Terminal</th><td>PowerShell 7 in tabs along the bottom, or Windows PowerShell, Command Prompt and Git Bash. "Terminal here" on any sidebar folder opens one there.</td></tr>
    <tr><th>📁 Files</th><td>Every workspace from Project Hub. Click a file to read it in a tab: Markdown rendered, code as code, images inline. Right-click for VS Code, Explorer, or copy path.</td></tr>
    <tr><th>🔖 Bookmarks</th><td>Your Chrome, Edge or Brave bookmarks, read from disk by Hub, or Hub's own favorites.</td></tr>
    <tr><th>🔍 Search</th><td>One search box across files, bookmarks and the pages, files and terminals you opened recently.</td></tr>
    <tr><th>🤖 MCP server</th><td>A local MCP server with tools that look (<code>list_tabs</code>, <code>read_tab</code>, <code>sidebar_search</code>, <code>terminal_read</code>) and tools that act (<code>open_tab</code>, <code>open_file</code>, <code>terminal_run</code>, <code>cron_run</code>). Anything that runs waits for your click, and every call is logged in the MCP tab.</td></tr>
    <tr><th>💬 Chat</th><td>Claude in the sidebar with the app's MCP tools. <b>+ page</b> and <b>+ terminal</b> attach what a tab or terminal shows; replies stream in and the conversation survives a restart.</td></tr>
    <tr><th>⏱️ Cron</th><td><a href="https://github.com/ai-automation-tools/cronsole" target="_blank" rel="noopener">Cronsole</a>'s scheduled tasks at a glance, with its full UI in a pinned tab. An agent can start a task after you click Run.</td></tr>
  </table>

  <h2>Get it</h2>
  <p>Windows 11, Node.js 24, PowerShell 7 and a running Project Hub. Then:</p>
  <pre><code>git clone ${REPO_URL}
cd ai-command-center
npm install
npm start</code></pre>
  <p>Setup, settings and the <code>claude mcp add</code> line are in the <a href="${REPO_URL}#readme" target="_blank" rel="noopener">README on GitHub</a>. GPL-3.0-or-later.</p>
</article>`;
