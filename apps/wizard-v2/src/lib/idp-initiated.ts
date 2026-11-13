/**
 * Naming convention for IdP-initiated SSO.
 *
 * An IdP-initiated setup pairs the identity provider `{alias}` with a SAML
 * client whose clientId and IdP-initiated SSO URL name are both
 * `idp-initiated-{alias}`. The upstream IdP posts its unsolicited response to
 * the broker endpoint for that client; after the brokered login Keycloak sends
 * the user on to the client's target application.
 */

export const IDP_INITIATED_CLIENT_PREFIX = "idp-initiated-";

/** clientId (and `saml_idp_initiated_sso_url_name`) of the paired client. */
export function idpInitiatedClientId(alias: string): string {
  return `${IDP_INITIATED_CLIENT_PREFIX}${alias}`;
}

/**
 * ACS URL the upstream IdP posts to for IdP-initiated logins:
 * `{serverUrl}/realms/{realm}/broker/{alias}/endpoint/clients/idp-initiated-{alias}`.
 */
export function idpInitiatedAcsUrl(brokerEndpoint: string, alias: string): string {
  return `${brokerEndpoint}/clients/${idpInitiatedClientId(alias)}`;
}

/**
 * Login URL that starts an IdP-initiated sign-in through an OIDC identity
 * provider:
 * `{serverUrl}/realms/{realm}/protocol/saml/clients/idp-initiated-{alias}?kc_idp_hint={alias}`.
 *
 * OIDC has no unsolicited response, so the upstream IdP's app tile (or
 * "Initiate login URI") points here instead. The paired SAML client's
 * IdP-initiated endpoint runs the realm browser flow, whose Identity Provider
 * Redirector reads `kc_idp_hint` and starts a normal brokered login at
 * `{alias}`. Afterwards Keycloak sends the user to the client's target
 * application.
 *
 * @param realmUrl `{serverUrl}/realms/{realm}`
 */
export function idpInitiatedLoginUrl(realmUrl: string, alias: string): string {
  const clientId = encodeURIComponent(idpInitiatedClientId(alias));
  return `${realmUrl}/protocol/saml/clients/${clientId}?kc_idp_hint=${encodeURIComponent(alias)}`;
}
