/**
 * Maps a failed HTTP response from a wizard action to a user-facing message.
 *
 * Wizard JSON files carry a static, per-action error string ("Validation
 * failed. Check the file and try again."). That hint is only right when the
 * request itself was bad — it misleads when the real cause is a missing
 * permission or a network failure. This helper picks a message based on the
 * response status before falling back to the wizard's string.
 */

export type ErrorScope = "organization" | "realm";

export interface DescribeHttpErrorParams {
  status: number;
  data: unknown;
  /** The wizard JSON's static error string for this action, if any. */
  fallback?: string;
  /** Whether the request targeted the org-scoped or realm admin API. */
  scope: ErrorScope;
  /**
   * The role required for the action, when known. Named in the permission
   * message so the admin knows what to ask for.
   */
  requiredRole?: string;
  /**
   * Message for a 409 Conflict, when the action has a more helpful one than
   * the server's text (e.g. creating an IdP whose alias is already taken).
   */
  conflictMessage?: string;
}

export const NETWORK_ERROR_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

const MAX_SERVER_MESSAGE_LENGTH = 300;

/**
 * Extracts a human-readable message from a Keycloak / Phase Two error body.
 * Keycloak uses `errorMessage` (admin API) or `error_description`/`error`
 * (OAuth-style); some endpoints return plain text.
 */
export function extractServerMessage(data: unknown): string | null {
  let msg: unknown = null;

  if (typeof data === "string") {
    msg = data;
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    msg =
      obj.errorMessage ?? obj.error_description ?? obj.message ?? obj.error;
  }

  if (typeof msg !== "string") return null;
  const trimmed = msg.trim();
  // Ignore empty bodies, HTML error pages, and oversized dumps
  if (!trimmed || trimmed.startsWith("<")) return null;
  if (trimmed.length > MAX_SERVER_MESSAGE_LENGTH) return null;
  return trimmed;
}

export function describeHttpError({
  status,
  data,
  fallback,
  scope,
  requiredRole,
  conflictMessage,
}: DescribeHttpErrorParams): string {
  if (status === 401 || status === 403) {
    const base =
      requiredRole === "manage-identity-providers"
        ? `You don't have permission to manage identity providers for this ${scope}.`
        : `You don't have permission to perform this action for this ${scope}.`;
    return requiredRole
      ? `${base} Ask an administrator to grant you the "${requiredRole}" role.`
      : base;
  }

  if (status === 409 && conflictMessage) return conflictMessage;

  if (status >= 400 && status < 500) {
    const serverMessage = extractServerMessage(data);
    if (serverMessage) return serverMessage;
  }

  return fallback ?? `Action failed (HTTP ${status})`;
}

/** Shown when creating an IdP returns 409 (its alias is already taken). */
export function idpConflictMessage(scope: ErrorScope): string {
  return (
    `An identity provider with this alias already exists in this ${scope}. ` +
    "It may have been created by an earlier attempt. Check the identity " +
    "providers list before trying again."
  );
}
