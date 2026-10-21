// A workspace's chat conversations: the index (names, when each was last used, which
// one is open) and searching them. The messages themselves live one file per
// conversation (src/main/store.js); this file only decides what's valid.

export const CONVERSATIONS_VERSION = 1;
export const CONVERSATIONS_MAX = 100;
export const NAME_MAX = 80;
const TITLE_LEN = 50;
const SNIPPET = 40;
const CONV_ID = /^c[a-z0-9]{1,20}$/;

/** @typedef {{ id: string, name: string, updated: number }} ConversationEntry */
/** @typedef {{ version: number, active: string | null, list: ConversationEntry[] }} ConversationIndex active: null until the first message of a new one */

/** @param {unknown} id */
export const isConversationId = (id) => typeof id === 'string' && CONV_ID.test(id);

/** @param {unknown} name */
const cleanName = (name) => (typeof name === 'string' ? name.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').trim().slice(0, NAME_MAX) : '');

/**
 * index.json as read from disk: bad entries and duplicates dropped, newest first, capped;
 * `active` kept only when it names a listed conversation.
 * @param {unknown} raw
 * @returns {ConversationIndex}
 */
export function cleanIndex(raw) {
  const r = /** @type {any} */ (raw && typeof raw === 'object' ? raw : {});
  /** @type {ConversationEntry[]} */
  const list = [];
  const seen = new Set();
  for (const e of Array.isArray(r.list) ? r.list : []) {
    if (!e || !isConversationId(e.id) || seen.has(e.id)) continue;
    seen.add(e.id);
    list.push({ id: e.id, name: cleanName(e.name), updated: Number.isFinite(e.updated) ? e.updated : 0 });
  }
  list.sort((a, b) => b.updated - a.updated);
  list.length = Math.min(list.length, CONVERSATIONS_MAX);
  const active = list.some((e) => e.id === r.active) ? r.active : null;
  return { version: CONVERSATIONS_VERSION, active, list };
}

/**
 * A name from the conversation's first message: one line, attachments left out.
 * @param {import('./chat.js').Message[]} messages
 */
export function titleFrom(messages) {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return '';
  const text = typeof first.content === 'string' ? first.content : first.content.map((b) => (b.type === 'text' ? b.text : '')).join(' ');
  const plain = text
    .replace(/<attached (\w+)>\n[\s\S]*?\n<\/attached \1>/g, ' ')
    .replace(/\(The \w+ couldn't be attached: [^\n]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > TITLE_LEN ? `${plain.slice(0, TITLE_LEN - 1).trimEnd()}…` : plain;
}

/**
 * After a message: the open conversation moves to the top with the time, and gets a name
 * from its first message if it has none. A new one (active null) is added with an id
 * made from the time, unique in the list. The oldest go past the cap.
 * @param {ConversationIndex} index
 * @param {import('./chat.js').Message[]} messages
 * @param {number} now
 * @returns {ConversationIndex}
 */
export function touchConversation(index, messages, now) {
  let id = index.active;
  if (!id) {
    const base = `c${Math.max(0, Math.floor(now)).toString(36)}`;
    id = base;
    for (let n = 2; index.list.some((e) => e.id === id); n++) id = `${base}${n.toString(36)}`;
  }
  const old = index.list.find((e) => e.id === id);
  const entry = { id, name: old?.name || titleFrom(messages), updated: now };
  const list = [entry, ...index.list.filter((e) => e.id !== id)].slice(0, CONVERSATIONS_MAX);
  return { version: CONVERSATIONS_VERSION, active: id, list };
}

/**
 * @param {ConversationIndex} index
 * @param {unknown} id
 * @param {unknown} name blank goes back to the name from its first message (the caller passes it)
 * @param {string} fallback
 * @returns {ConversationIndex}
 */
export function renameConversation(index, id, name, fallback) {
  if (!index.list.some((e) => e.id === id)) throw new Error('No such conversation.');
  const next = cleanName(name) || fallback;
  return { ...index, list: index.list.map((e) => (e.id === id ? { ...e, name: next } : e)) };
}

/**
 * Removing the open one leaves a fresh, empty conversation open.
 * @param {ConversationIndex} index
 * @param {unknown} id
 * @returns {ConversationIndex}
 */
export function removeConversation(index, id) {
  if (!index.list.some((e) => e.id === id)) throw new Error('No such conversation.');
  return { ...index, active: index.active === id ? null : index.active, list: index.list.filter((e) => e.id !== id) };
}

/**
 * The words a conversation can be found by: its user and assistant text, attachments left out.
 * @param {import('./chat.js').Message[]} messages
 */
export function conversationText(messages) {
  /** @type {string[]} */
  const parts = [];
  for (const m of messages) {
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
    for (const b of /** @type {any[]} */ (blocks)) {
      if (b.type === 'text') parts.push(String(b.text).replace(/<attached (\w+)>\n[\s\S]*?\n<\/attached \1>/g, ' '));
    }
  }
  return parts.join('\n').replace(/\s+/g, ' ').trim();
}

/**
 * The list the Chat tab shows: every conversation, newest first, or with a query only
 * those where every word is in the name or the text, each with a snippet around the
 * first word's first match in the text.
 * @param {(ConversationEntry & { text: string })[]} items
 * @param {string} query
 * @returns {(ConversationEntry & { snippet: string })[]}
 */
export function searchConversations(items, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  /** @type {(ConversationEntry & { snippet: string })[]} */
  const out = [];
  for (const { text, ...e } of items) {
    const hay = `${e.name}\n${text}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    let snippet = '';
    const at = words.length ? text.toLowerCase().indexOf(words[0]) : -1;
    if (at >= 0) {
      const from = Math.max(0, at - SNIPPET);
      const to = Math.min(text.length, at + words[0].length + SNIPPET);
      snippet = `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`;
    }
    out.push({ ...e, snippet });
  }
  return out.sort((a, b) => b.updated - a.updated);
}
