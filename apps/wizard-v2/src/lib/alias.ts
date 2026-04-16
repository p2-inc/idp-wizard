/**
 * Generates and persists a wizard alias for the current browser session.
 *
 * The alias is stored in sessionStorage so it survives page refreshes within
 * the same tab but is automatically cleared when the tab closes. This matches
 * the v1 behavior (localStorage) but avoids stale aliases across sessions.
 *
 * Format: `{prefix}-{6-char random suffix}` — e.g. "generic-saml-a1b2c3"
 */
export function getOrCreateAlias(sessionKey: string, prefix: string): string {
  const existing = sessionStorage.getItem(sessionKey);
  if (existing) return existing;

  const suffix = Math.random().toString(36).slice(2, 8);
  const alias = `${prefix}-${suffix}`;
  sessionStorage.setItem(sessionKey, alias);
  return alias;
}

/** Removes the alias from sessionStorage on wizard completion or cancellation. */
export function clearAlias(sessionKey: string): void {
  sessionStorage.removeItem(sessionKey);
}
