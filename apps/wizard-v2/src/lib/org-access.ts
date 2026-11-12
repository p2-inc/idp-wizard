/**
 * Who may configure identity providers where.
 *
 * Two scopes, two different APIs:
 *
 * - **Organization** — Phase Two Orgs API (`/realms/{realm}/orgs/{orgId}/idps/...`).
 *   The server only checks the org-level identity-provider roles (plus org membership,
 *   which having roles in the `organizations` claim implies). `view-organization` and
 *   `manage-organization` are *not* needed, so they are not required here either.
 * - **Global (realm-wide)** — Keycloak Admin API (`/admin/realms/{realm}/identity-provider/...`).
 *   Requires the realm-management client roles of the same names.
 *
 * Kept free of React and oidc-spa so it can be unit tested.
 */

/** Org roles the Orgs API checks for viewing and creating an org's identity providers. */
export const REQUIRED_ORG_IDP_ROLES = [
  "view-identity-providers",
  "manage-identity-providers",
] as const;

/** Realm-management client roles the Admin API checks for identity providers. */
export const REQUIRED_REALM_IDP_ROLES = [
  "view-identity-providers",
  "manage-identity-providers",
] as const;

/** Shape of the Phase Two `organizations` token claim. */
export type OrgClaims = Record<string, { name?: string; roles?: string[] }>;

export interface OrgOption {
  id: string;
  name: string;
  /** Required org roles the user lacks; empty when the org can be configured. */
  missingRoles: string[];
}

export function isEligible(org: OrgOption): boolean {
  return org.missingRoles.length === 0;
}

/** Every org in the claim, in claim order, annotated with the roles it is missing. */
export function listOrgOptions(orgs: OrgClaims | undefined | null): OrgOption[] {
  return Object.entries(orgs ?? {}).map(([id, entry]) => ({
    id,
    name: entry?.name ?? id,
    missingRoles: REQUIRED_ORG_IDP_ROLES.filter(
      (r) => !entry?.roles?.includes(r),
    ),
  }));
}

/**
 * Whether the user can configure realm-wide identity providers.
 *
 * - `"granted"` / `"denied"` — determined from the access token.
 * - `"unknown"` — no usable token claims (e.g. an opaque token); callers must not
 *   restrict anything on this basis.
 * - `"loading"` — the token has not been read yet.
 */
export type RealmIdpAccess = "loading" | "granted" | "denied" | "unknown";

/**
 * The client holding realm admin roles for `targetRealm` in a token issued by `authRealm`:
 * `realm-management` within the realm itself, `{targetRealm}-realm` when authenticating
 * against `master` to administer another realm.
 */
export function realmManagementClient(authRealm: string, targetRealm: string): string {
  return authRealm === "master" && targetRealm !== "master"
    ? `${targetRealm}-realm`
    : "realm-management";
}

/**
 * Reads realm identity-provider access from decoded access-token claims. Keycloak expands
 * composite roles (e.g. `realm-admin`) into `resource_access`, so a plain lookup suffices.
 */
export function realmIdpAccessFromClaims(
  claims: Record<string, unknown> | undefined,
  authRealm: string,
  targetRealm: string,
): RealmIdpAccess {
  if (!claims) return "unknown";
  const resourceAccess = claims.resource_access as
    | Record<string, { roles?: string[] } | undefined>
    | undefined;
  const roles =
    resourceAccess?.[realmManagementClient(authRealm, targetRealm)]?.roles ?? [];
  return REQUIRED_REALM_IDP_ROLES.every((r) => roles.includes(r))
    ? "granted"
    : "denied";
}

/** Decodes a JWT's payload without verifying it. Returns undefined for non-JWTs. */
export function decodeJwtPayload(
  token: string | undefined,
): Record<string, unknown> | undefined {
  const payload = token?.split(".")[1];
  if (!payload) return undefined;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    );
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
