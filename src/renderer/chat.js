// The sidebar's Chat panel. The conversation and the API key live in the main process
// (src/main/chat.js); this file only shows the turns and sends what the user types.
// Everything Claude says is shown as text, never as HTML.

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @param {any} api */
export async function startChat(api) {
  const log = $('chat-log');
  const input = /** @type {HTMLTextAreaElement} */ ($('chat-input'));
  const sendBtn = /** @type {HTMLButtonElement} */ ($('chat-send'));
  const stopBtn = /** @type {HTMLButtonElement} */ ($('chat-stop'));
  /** While a turn runs, Stop takes Send's place. @param {boolean} on */
  const busy = (on) => {
    sendBtn.disabled = on;
    sendBtn.hidden = on;
    stopBtn.hidden = !on;
  };
  stopBtn.addEventListener('click', () => api.chat.stop());

  // The context tray. + page and + terminal have the main process read the tab or
  // terminal now (read_tab, terminal_read) and keep that snapshot; the tray shows it,
  // exact text included, and the next message sends exactly those rows.
  /** @type {{ id: number, kind: string, label: string, detail: string, text: string }[]} */
  let tray = [];
  let model = '';
  const trayEl = $('chat-tray');
  const renderTray = () => {
    const list = $('chat-tray-items');
    list.innerHTML = '';
    for (const t of tray) {
      const row = document.createElement('div');
      row.className = 'tray-item';
      row.innerHTML = '<span class="tray-icon"></span><span class="tray-label"></span><button type="button" class="tray-remove">✕</button><span class="tray-detail"></span><details><summary>Show what\'s sent</summary><pre></pre></details>';
      /** @type {HTMLElement} */ (row.querySelector('.tray-icon')).textContent = t.kind === 'page' ? '🌐' : '>_';
      /** @type {HTMLElement} */ (row.querySelector('.tray-label')).textContent = t.label;
      /** @type {HTMLElement} */ (row.querySelector('.tray-detail')).textContent = t.detail;
      /** @type {HTMLElement} */ (row.querySelector('pre')).textContent = t.text;
      const remove = /** @type {HTMLButtonElement} */ (row.querySelector('.tray-remove'));
      remove.title = `Don't send ${t.label}`;
      remove.setAttribute('aria-label', remove.title);
      remove.addEventListener('click', () => {
        tray = tray.filter((x) => x.id !== t.id);
        renderTray();
        input.focus();
      });
      list.append(row);
    }
    $('chat-tray-dest').textContent = `Goes with your message to ${model || 'Claude'} at api.anthropic.com.`;
    trayEl.hidden = !tray.length;
  };
  for (const kind of ['page', 'terminal']) {
    const b = /** @type {HTMLButtonElement} */ ($(`chat-attach-${kind}`));
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const item = await api.chat.attach(kind);
        // A second read of the same kind replaces the first, as it does in the main process.
        tray = [...tray.filter((x) => x.kind !== kind), item];
        renderTray();
      } catch (err) {
        line('error', errText(err));
      } finally {
        b.disabled = false;
      }
    });
  }

  /** @param {string} cls @param {string} text */
  const line = (cls, text) => {
    const d = document.createElement('div');
    d.className = `chat-msg ${cls}`;
    d.textContent = text;
    log.append(d);
    log.scrollTop = log.scrollHeight;
    return d;
  };
  /** The reply being streamed in, until any other event closes it. @type {HTMLElement | null} */
  let streaming = null;
  /** @type {HTMLElement | null} */
  let thinking = null;
  /** @param {import('./shared/chat.js').ChatEvent} e */
  const show = (e) => {
    thinking?.remove();
    thinking = null;
    if (e.type === 'delta') {
      streaming ??= line('assistant', '');
      streaming.append(e.text);
      log.scrollTop = log.scrollHeight;
      return;
    }
    streaming = null;
    if (e.type === 'text') line('assistant', e.text);
    if (e.type === 'note') line('note', e.text);
    if (e.type === 'user') line('user', e.text);
    if (e.type === 'tool') line('tool', `→ ${e.name} ${JSON.stringify(e.input)}`);
    if (e.type === 'result') line(`tool ${e.ok ? 'ok' : 'failed'}`, `${e.ok ? '✓' : '✗'} ${e.text}`);
  };
  const intro = async () => {
    log.innerHTML = '';
    const info = await api.chat.info();
    $('chat-model').textContent = info.model;
    model = info.model;
    // Switching conversation or workspace empties the main process's tray too.
    tray = [];
    renderTray();
    if (info.missing.length) {
      line('note', `To chat, set ${info.missing.join(' and ')} in the app's .env file (see .env.example), then restart the app. The key stays in the main process and is never saved by the app.`);
    } else if (!info.mcp) {
      line('note', "The app's MCP server didn't start, so the chat has no tools.");
    } else {
      line('note', `Claude (${info.model}) can open tabs and files, search the sidebar, and run commands in the terminal after you click Run. + page and + terminal read the tab or terminal into the tray above the box: what's there goes with your next message, and ✕ takes it out. Its calls show in the MCP tab.`);
    }
    // The open conversation, as saved.
    for (const e of info.history || []) show(e);
    streaming = null;
    await loadConvs();
  };

  // The workspace's conversations: the open one's name on top, a searchable list under it.
  const convTitle = /** @type {HTMLButtonElement} */ ($('chat-conv-title'));
  const convPanel = $('chat-convs');
  const convSearch = /** @type {HTMLInputElement} */ ($('chat-conv-search'));
  const convList = $('chat-conv-list');
  /** @type {{ active: string | null, name: string, list: { id: string, name: string, updated: number, snippet: string }[] }} */
  let convs = { active: null, name: '', list: [] };
  const loadConvs = async () => {
    convs = await api.chat.list(convSearch.value);
    renderConvs();
  };
  const showConvs = (/** @type {boolean} */ on) => {
    convPanel.hidden = !on;
    convTitle.setAttribute('aria-expanded', String(on));
    if (on) {
      convSearch.value = '';
      loadConvs().catch((err) => line('error', errText(err)));
      convSearch.focus();
    }
  };
  /** Open, start or delete, then show what's open now. @param {Promise<unknown>} change */
  const changeConv = async (change) => {
    try {
      await change;
      showConvs(false);
      await intro();
      input.focus();
    } catch (err) {
      line('error', errText(err));
    }
  };
  const renderConvs = () => {
    convTitle.textContent = `${convs.name || 'New conversation'} ▾`;
    convList.innerHTML = '';
    if (!convs.list.length) {
      convList.innerHTML = '<div class="panel-note"></div>';
      /** @type {HTMLElement} */ (convList.firstElementChild).textContent = convSearch.value.trim() ? 'No conversation matches.' : 'Nothing saved yet: a conversation is listed after its first message.';
    }
    for (const c of convs.list) {
      const row = document.createElement('div');
      row.className = `conv-row${c.id === convs.active ? ' active' : ''}`;
      row.setAttribute('role', 'listitem');
      row.innerHTML = '<span class="conv-name"></span><span class="conv-when"></span><button type="button" class="conv-act conv-rename">✎</button><button type="button" class="conv-act conv-delete">✕</button>';
      const name = /** @type {HTMLElement} */ (row.querySelector('.conv-name'));
      name.textContent = c.name || 'Untitled';
      /** @type {HTMLElement} */ (row.querySelector('.conv-when')).textContent = ago(c.updated);
      if (c.snippet) {
        const s = document.createElement('span');
        s.className = 'conv-snippet';
        s.textContent = c.snippet;
        row.append(s);
      }
      row.addEventListener('click', (e) => {
        if (!(e.target instanceof HTMLElement) || e.target.closest('button, input')) return;
        if (c.id !== convs.active) changeConv(api.chat.open(c.id));
        else showConvs(false);
      });
      const rename = /** @type {HTMLButtonElement} */ (row.querySelector('.conv-rename'));
      rename.title = 'Rename';
      rename.setAttribute('aria-label', `Rename ${c.name || 'Untitled'}`);
      rename.addEventListener('click', () => {
        const box = document.createElement('input');
        box.className = 'conv-name-edit';
        box.value = c.name;
        box.maxLength = 80;
        box.setAttribute('aria-label', 'New name; Enter saves, Esc cancels');
        name.replaceWith(box);
        box.focus();
        box.select();
        let done = false;
        const finish = async (/** @type {boolean} */ save) => {
          if (done) return;
          done = true;
          try {
            if (save && box.value !== c.name) await api.chat.rename(c.id, box.value);
            await loadConvs();
          } catch (err) {
            line('error', errText(err));
          }
        };
        box.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
        });
        box.addEventListener('blur', () => finish(true));
      });
      // Two clicks to delete: the first asks, and the ask lapses after a few seconds.
      const del = /** @type {HTMLButtonElement} */ (row.querySelector('.conv-delete'));
      del.title = 'Delete';
      del.setAttribute('aria-label', `Delete ${c.name || 'Untitled'}`);
      del.addEventListener('click', async () => {
        if (del.dataset.armed !== '1') {
          del.dataset.armed = '1';
          del.textContent = 'Delete?';
          del.title = 'Click again to delete this conversation for good';
          setTimeout(() => {
            if (!del.isConnected) return;
            del.dataset.armed = '';
            del.textContent = '✕';
            del.title = 'Delete';
          }, 3000);
          return;
        }
        try {
          await api.chat.delete(c.id);
          await intro();
          showConvs(true);
        } catch (err) {
          line('error', errText(err));
        }
      });
      convList.append(row);
    }
  };
  convTitle.addEventListener('click', () => showConvs(convPanel.hidden));
  $('chat-new').addEventListener('click', () => changeConv(api.chat.new()));
  let searchTimer = 0;
  convSearch.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => loadConvs().catch((err) => line('error', errText(err))), 150);
  });
  convSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      showConvs(false);
      input.focus();
    }
  });

  api.chat.onEvent(show);

  $('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    const sending = tray;
    line('user', [...sending.map((t) => `[+ ${t.kind}]`), text].join(' '));
    input.value = '';
    tray = [];
    renderTray();
    busy(true);
    thinking = line('note', 'Thinking…');
    try {
      await api.chat.send(text, sending.map((t) => t.id));
    } catch (err) {
      line('error', errText(err));
    } finally {
      thinking?.remove();
      thinking = null;
      streaming = null;
      busy(false);
      input.focus();
      // A first message names and lists the conversation.
      loadConvs().catch(() => {});
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('chat-form').requestSubmit();
    }
  });
  await intro();
  // A workspace switch brings its own conversation.
  api.workspace.onChanged(() => intro().catch(() => {}));
}

/** How long ago, roughly: "just now", "5 min", "3 h", "2 d", then the date. @param {number} t */
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Date(t).toLocaleDateString();
}

/** @param {unknown} err */
function errText(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}
