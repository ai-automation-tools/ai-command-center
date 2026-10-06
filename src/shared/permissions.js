// What a web page may be granted when it asks. Everything else is refused: without a
// handler Electron grants whatever a page requests, camera and location included.
// Fullscreen and pointer lock are harmless and video sites need them; sanitized
// clipboard writes let "Copy" buttons work. Reading the clipboard, media devices,
// location, notifications, MIDI, USB, serial, HID and screen capture are all denied.

const ALLOWED = new Set(['fullscreen', 'pointerLock', 'clipboard-sanitized-write']);

/** @param {unknown} permission Electron's permission name */
export function isPermissionAllowed(permission) {
  return ALLOWED.has(String(permission));
}
