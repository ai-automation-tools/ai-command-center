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
  // Toggles: what's pressed is read by the main process (read_tab, terminal_read) and
  // goes above the next message; the text never passes through this file.
  const attachBtns = { page: $('chat-attach-page'), terminal: $('chat-attach-terminal') };
  for (const b of Object.values(attachBtns)) {
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));
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
    if (info.missing.length) {
      line('note', `To chat, set ${info.missing.join(' and ')} in the app's .env file (see .env.example), then restart the app. The key stays in the main process and is never saved by the app.`);
    } else if (!info.mcp) {
      line('note', "The app's MCP server didn't start, so the chat has no tools.");
    } else {
      line('note', `Claude (${info.model}) can open tabs and files, search the sidebar, and run commands in the terminal after you click Run. + page and + terminal attach what the tab or terminal shows to your next message. Its calls show in the MCP tab.`);
    }
    // The conversation saved at the last close; Clear forgets it.
    for (const e of info.history || []) show(e);
    streaming = null;
  };

  api.chat.onEvent(show);

  $('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    const attach = Object.entries(attachBtns).filter(([, b]) => b.getAttribute('aria-pressed') === 'true').map(([k]) => k);
    line('user', [...attach.map((k) => `[+ ${k}]`), text].join(' '));
    input.value = '';
    for (const b of Object.values(attachBtns)) b.setAttribute('aria-pressed', 'false');
    busy(true);
    thinking = line('note', 'Thinking…');
    try {
      await api.chat.send(text, attach);
    } catch (err) {
      line('error', errText(err));
    } finally {
      thinking?.remove();
      thinking = null;
      streaming = null;
      busy(false);
      input.focus();
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('chat-form').requestSubmit();
    }
  });
  $('chat-clear').addEventListener('click', async () => {
    try {
      await api.chat.reset();
      await intro();
    } catch (err) {
      line('error', errText(err));
    }
  });

  await intro();
}

/** @param {unknown} err */
function errText(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}
