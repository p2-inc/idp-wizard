/**
 * Access checks that decide which scopes the org picker offers.
 *
 * Two scopes exist:
 * - **Global (realm-wide)** — the wizard calls the Keycloak admin API, which needs the
 *   realm IdP roles on the realm's management client.
 * - **Organization** — the wizard calls the Phase Two Orgs API, which needs org roles
 *   from the `organizations` token claim.
 *
 * Kept free of React and app imports so the logic can be tested in isolation.
 */

/** Roles needed in an org to manage its identity providers. */
export const REQUIRED_ORG_ROLES = [
  "view-organization",
  "manage-organization",
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

export function hasAllOrgRoles(orgEntry: { roles?: string[] }): boolean {
  return REQUIRED_ORG_ROLES.every((r) => orgEntry.roles?.includes(r));
}

/** Org ids the user can manage IdPs for, in claim order. */
export function eligibleOrgIds(orgs: OrgClaims): string[] {
  return Object.entries(orgs)
    .filter(([, v]) => hasAllOrgRoles(v))
    .map(([id]) => id);
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
 * token and ID token can be passed together.
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
 * The org to select when the URL has none: the user's only eligible org, when Global
 * is not an option for them. Returns null when there is nothing to default to.
 */
export function defaultOrgId(
  eligible: string[],
  canUseGlobal: boolean,
): string | null {
  return !canUseGlobal && eligible.length === 1 ? eligible[0] : null;
}
