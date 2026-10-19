// Project Hub's /api/events server-sent events, parsed from the response body's byte
// stream. Hub sends `retry: 3000`, then, on each rescan the watcher noticed, one
// `event: change` with a `data: {"why":"<path>"}` payload, plus a `: ping` comment
// heartbeat every 25 s so idle proxies leave the stream alone. The main process
// (src/main/hub.js) feeds this decoded text and calls back on each `change`. Pure.

/**
 * Feed one decoded chunk of an SSE stream and get back the events it finished.
 * `buffer` is the text carried over from the previous chunk that hasn't ended in a
 * blank line yet, so an event or a multibyte character split across chunks is handled.
 * A chunk may finish several events or none; events end on a blank line.
 *
 * @param {string} buffer
 * @param {string} text
 * @returns {{ buffer: string, events: { event: string, data: string }[] }}
 */
export function feedSse(buffer, text) {
  buffer = (buffer + text).replace(/\r\n/g, '\n');
  const events = [];
  let at;
  while ((at = buffer.indexOf('\n\n')) >= 0) {
    const block = buffer.slice(0, at);
    buffer = buffer.slice(at + 2);
    const event = parseBlock(block);
    if (event) events.push(event);
  }
  return { buffer, events };
}

/**
 * One event block (the lines between two blank lines). Comment lines and fields with
 * no data (the `retry:` preamble, a bare `: ping`) carry no event.
 * @param {string} block
 * @returns {{ event: string, data: string } | null}
 */
function parseBlock(block) {
  let event = 'message';
  const data = [];
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (!data.length) return null;
  return { event, data: data.join('\n') };
}
