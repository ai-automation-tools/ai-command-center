// Native context menus for the shell UI. The renderer lists `{ id, label }` items and
// '-' separators; main pops up an Electron Menu and answers with the id picked.

const MAX_ITEMS = 40;
const MAX_LABEL = 200;

/**
 * @param {unknown} value
 * @returns {({ id: string, label: string } | '-')[]}
 */
export function menuItems(value) {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) throw new Error(`menu must be a list of at most ${MAX_ITEMS} items`);
  return value.map((i) => {
    if (i === '-') return '-';
    if (!i || typeof i.id !== 'string' || typeof i.label !== 'string' || !i.label || i.label.length > MAX_LABEL) {
      throw new Error('a menu item needs a string id and a label');
    }
    return { id: i.id, label: i.label };
  });
}
