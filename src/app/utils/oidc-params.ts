/**
 * OIDC response parameters that Keycloak refuses to accept nested inside a
 * `redirect_uri`. Mirrors `FORBIDDEN_OIDC_PARAMS` in Keycloak's
 * `RedirectUtils`, added in 26.6.5 as HTTP-parameter-pollution hardening.
 *
 * The check runs before redirect URI matching, so a `redirect_uri` carrying any
 * of these is rejected with "Invalid parameter: redirect_uri" no matter how the
 * client is registered.
 */
export const FORBIDDEN_OIDC_PARAMS = [
  "code",
  "id_token",
  "access_token",
  "token_type",
  "expires_in",
  "state",
  "iss",
  "error",
  "error_description",
  "session_state",
  "response",
  "kc_action",
  "kc_action_status",
];

const isForbidden = (name: string) =>
  FORBIDDEN_OIDC_PARAMS.includes(name.toLowerCase());

const hasForbidden = (params: string) =>
  Array.from(new URLSearchParams(params).keys()).some(isForbidden);

const withoutForbidden = (params: string) => {
  const search = new URLSearchParams(params);
  Array.from(search.keys())
    .filter(isForbidden)
    .forEach((name) => search.delete(name));
  return search.toString();
};

/**
 * Remove OIDC response parameters from a URL so it is safe to hand to Keycloak
 * as a `redirect_uri`. Untouched — byte for byte — when there is nothing to
 * strip, so hash routes and ordinary query parameters survive intact.
 */
export const stripOidcParams = (href: string): string => {
  const url = new URL(href);

  if (hasForbidden(url.search)) {
    const stripped = withoutForbidden(url.search);
    url.search = stripped ? `?${stripped}` : "";
  }

  // response_mode=fragment delivers the same parameters in the fragment.
  const fragment = url.hash.replace(/^#/, "");
  if (fragment.includes("=") && hasForbidden(fragment)) {
    const stripped = withoutForbidden(fragment);
    url.hash = stripped ? `#${stripped}` : "";
  }

  return url.toString();
};

/**
 * Drop OIDC response parameters from the address bar without reloading, and
 * return a URL that is safe to hand to Keycloak as `redirect_uri`.
 *
 * The portal link (`POST /orgs/{id}/portal-link`) lands the user on the wizard
 * with an authorization response in the *query* string, while keycloak-js reads
 * the *fragment* by default. keycloak-js therefore never consumes those
 * parameters, and its subsequent `login()` defaults `redirect_uri` to
 * `window.location.href` — which still carries them, and is rejected.
 *
 * Only the query string is cleared. Under `response_mode=fragment` the fragment
 * is keycloak-js's own callback channel, so clearing it here would delete the
 * authorization response before keycloak-js could read it — leaving the app in
 * a login redirect loop that never reaches the token endpoint. The returned
 * redirect target is stripped of both, because Keycloak rejects these
 * parameters wherever they appear in a `redirect_uri`.
 */
export const stripOidcParamsFromLocation = (): string => {
  const url = new URL(window.location.href);

  if (hasForbidden(url.search)) {
    const stripped = withoutForbidden(url.search);
    url.search = stripped ? `?${stripped}` : "";
    window.history.replaceState({}, "", url.toString());
  }

  return stripOidcParams(window.location.href);
};
