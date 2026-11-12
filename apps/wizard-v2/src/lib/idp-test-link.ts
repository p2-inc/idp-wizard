import { fetchWithAuth } from "@/oidc";

const VALIDATION_PENDING_KEY = "home.idp.discovery.validationPending";
const TESTER_CLIENT_ID = "idp-tester";
const OIDC_RESPONSE_PARAMS = [
  "code",
  "state",
  "session_state",
  "iss",
  "error",
  "error_description",
  "error_uri",
];

export function stripOidcParams(href: string): string {
  const url = new URL(href);
  for (const name of OIDC_RESPONSE_PARAMS) url.searchParams.delete(name);
  url.hash = "";
  return url.toString();
}

export function buildTestLoginUrl(params: {
  serverUrl: string;
  realm: string;
  alias: string;
  redirectUri: string;
}): string {
  const { serverUrl, realm, alias, redirectUri } = params;
  // Resolve against the page so an empty serverUrl (mock mode) yields a
  // same-origin URL, matching how the API endpoints resolve, instead of
  // throwing "Invalid URL".
  const url = new URL(
    `${serverUrl}/realms/${realm}/protocol/openid-connect/auth`,
    window.location.href,
  );
  url.searchParams.set("client_id", TESTER_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid");
  url.searchParams.set("kc_idp_hint", alias);
  url.searchParams.set("prompt", "login");
  return url.toString();
}

export function isValidationPending(idp: unknown): boolean {
  if (!idp || typeof idp !== "object") return false;
  const config = (idp as { config?: Record<string, unknown> }).config;
  return String(config?.[VALIDATION_PENDING_KEY]) === "true";
}

/**
 * Returns the test-login link when the new IdP is pending validation.
 * Best effort: any failure (including building the link) yields undefined,
 * so it can never turn a successful IdP creation into an error.
 */
export async function resolveIdpTestLink(params: {
  getIdpUrl: string;
  testLoginUrl: () => string;
}): Promise<string | undefined> {
  try {
    const res = await fetchWithAuth(params.getIdpUrl, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return undefined;
    return isValidationPending(await res.json()) ? params.testLoginUrl() : undefined;
  } catch {
    return undefined;
  }
}
