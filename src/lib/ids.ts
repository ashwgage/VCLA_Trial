/** Short unique ids. Not crypto.randomUUID: that is unavailable over plain http on a LAN IP. */
export function newId(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
