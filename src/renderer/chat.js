// The sidebar's Chat panel. The conversation and the API key live in the main process
// (src/main/chat.js); this file only shows the turns and sends what the user types.
// Everything Claude says is shown as text, never as HTML.

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @param {any} api */
export async function startChat(api) {
  const log = $('chat-log');
  const input = /** @type {HTMLTextAreaElement} */ ($('chat-input'));
  const sendBtn = /** @type {HTMLButtonElement} */ ($('chat-send'));

  /** @param {string} cls @param {string} text */
  const line = (cls, text) => {
    const d = document.createElement('div');
    d.className = `chat-msg ${cls}`;
    d.textContent = text;
    log.append(d);
    log.scrollTop = log.scrollHeight;
    return d;
  };
  const intro = async () => {
    log.innerHTML = '';
    const info = await api.chat.info();
    $('chat-model').textContent = info.model;
    if (info.missing.length) {
      line('note', `To chat, set ${info.missing.join(' and ')} as user environment variables, then restart the app. The key stays in the main process and is never saved by the app.`);
    } else if (!info.mcp) {
      line('note', "The app's MCP server didn't start, so the chat has no tools.");
    } else {
      line('note', `Claude (${info.model}) can open tabs and files, search the sidebar, and run commands in the terminal after you click Run. Its calls show in the MCP tab.`);
    }
  };

  api.chat.onEvent((/** @type {import('./shared/chat.js').ChatEvent} */ e) => {
    if (e.type === 'text') line('assistant', e.text);
    if (e.type === 'tool') line('tool', `→ ${e.name} ${JSON.stringify(e.input)}`);
    if (e.type === 'result') line(`tool ${e.ok ? 'ok' : 'failed'}`, `${e.ok ? '✓' : '✗'} ${e.text}`);
  });

  $('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    line('user', text);
    input.value = '';
    sendBtn.disabled = true;
    const thinking = line('note', 'Thinking…');
    try {
      await api.chat.send(text);
    } catch (err) {
      line('error', errText(err));
    } finally {
      thinking.remove();
      sendBtn.disabled = false;
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
