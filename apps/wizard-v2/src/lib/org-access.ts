/**
 * Who may configure identity providers where, and which scopes the org picker offers.
 *
 * Two scopes, two different APIs:
 *
 * - **Organization** — Phase Two Orgs API (`/realms/{realm}/orgs/{orgId}/idps/...`).
 *   The server only checks the org-level identity-provider roles (plus org membership,
 *   which having roles in the `organizations` claim implies). `view-organization` and
 *   `manage-organization` are *not* needed, so they are not required here either.
 * - **Global (realm-wide)** — Keycloak Admin API (`/admin/realms/{realm}/identity-provider/...`).
 *   Requires the realm IdP roles on the realm's management client.
 *
 * Kept free of React and app imports so the logic can be tested in isolation.
 */

/** Org roles the Orgs API checks for viewing and creating an org's identity providers. */
export const REQUIRED_ORG_ROLES = [
  "view-identity-providers",
  "manage-identity-providers",
];

/** Realm-management roles needed to manage realm-wide identity providers. */
export const REQUIRED_REALM_IDP_ROLES = [
  "view-identity-providers",
  "manage-identity-providers",
];

/** Shape of the Phase Two `organizations` token claim. */
export type OrgClaims = Record<string, { name?: string; roles?: string[] }>;

/** Shape of Keycloak's `resource_access` token claim. */
export type ResourceAccess = Record<string, { roles?: string[] }>;

export interface OrgOption {
  id: string;
  /** The claim's `name`, falling back to the id. */
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
    missingRoles: REQUIRED_ORG_ROLES.filter((r) => !entry?.roles?.includes(r)),
  }));
}

/** Org ids the user can manage IdPs for, in claim order. */
export function eligibleOrgIds(orgs: OrgClaims | undefined | null): string[] {
  return listOrgOptions(orgs)
    .filter(isEligible)
    .map((o) => o.id);
}

/**
 * The client that holds the target realm's admin roles.
 *
 * Users of the realm itself get them on `realm-management`. Users of the master realm
 * administering another realm get them on `{targetRealm}-realm`.
 */
export function realmManagementClientId(
  authRealm: string,
  targetRealm: string,
): string {
  return authRealm === "master" && targetRealm && targetRealm !== "master"
    ? `${targetRealm}-realm`
    : "realm-management";
}

/**
 * Whether any of the given `resource_access` claims grant all realm IdP roles on the
 * target realm's management client. Roles are merged across claims, so the access
 * token and ID token can be passed together. Keycloak expands composite roles
 * (e.g. `realm-admin`) into `resource_access`, so a plain lookup suffices.
 */
export function hasRealmIdpRoles(
  resourceAccessClaims: Array<ResourceAccess | undefined>,
  authRealm: string,
  targetRealm: string,
): boolean {
  const clientId = realmManagementClientId(authRealm, targetRealm);
  const roles = new Set(
    resourceAccessClaims.flatMap((ra) => ra?.[clientId]?.roles ?? []),
  );
  return REQUIRED_REALM_IDP_ROLES.every((r) => roles.has(r));
}

/**
 * Whether the user can configure realm-wide identity providers.
 *
 * - `"granted"` / `"denied"` — determined from token claims.
 * - `"unknown"` — no token told us (e.g. an opaque access token and no
 *   `resource_access` in the ID token); callers must not restrict anything on this basis.
 * - `"loading"` — the access token has not been read yet.
 */
export type RealmIdpAccess = "loading" | "granted" | "denied" | "unknown";

/**
 * Realm IdP access from the `resource_access` claims of the available tokens. Pass `{}`
 * for a token that was read but carries no `resource_access`, and `undefined` for one
 * that could not be read; only when every entry is `undefined` is the answer `"unknown"`.
 */
export function realmIdpAccess(
  resourceAccessClaims: Array<ResourceAccess | undefined>,
  authRealm: string,
  targetRealm: string,
): Exclude<RealmIdpAccess, "loading"> {
  if (resourceAccessClaims.every((ra) => ra === undefined)) return "unknown";
  return hasRealmIdpRoles(resourceAccessClaims, authRealm, targetRealm)
    ? "granted"
    : "denied";
}

/**
 * The org to select when the URL has none: the user's only eligible org, when Global
 * is not an option for them. Returns null when there is nothing to default to.
 */
export function defaultOrgId(
  eligible: string[],
  canUseGlobal: boolean,
): string | null {
  return !canUseGlobal && eligible.length === 1 ? eligible[0] : null;
}
