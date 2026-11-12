import { oidcSpa } from "oidc-spa/react-spa";
import type { RuntimeConfig } from "./runtime-config";
import { decodeJwtPayload } from "./lib/org-access";

export const {
  bootstrapOidc,
  useOidc,
  getOidc,
  OidcInitializationGate,
} = oidcSpa
  .withAutoLogin()
  .createUtils();

const isMock = import.meta.env.VITE_OIDC_USE_MOCK === "true";

/**
 * Mock mode only: extra token claims read from `localStorage["wizard-v2:mock-claims"]`
 * as `{ "idToken": {...}, "accessToken": {...} }`, so E2E tests can simulate users with
 * different organization and realm roles. Never consulted outside mock mode.
 */
export const MOCK_CLAIMS_STORAGE_KEY = "wizard-v2:mock-claims";

function readMockClaims(
  token: "idToken" | "accessToken",
): Record<string, unknown> | undefined {
  try {
    const raw = localStorage.getItem(MOCK_CLAIMS_STORAGE_KEY);
    const value = raw ? (JSON.parse(raw) as Record<string, unknown>)[token] : undefined;
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Boots oidc-spa from runtime configuration.
 *
 * The issuer and client id come from the server (see `runtime-config.ts`) rather than
 * from build-time env, because one published JAR serves every realm of every install.
 * Must be awaited before the app renders — see `main.tsx`.
 */
export function initOidc(config: RuntimeConfig): Promise<void> {
  return bootstrapOidc(
    isMock
      ? {
          implementation: "mock",
          isUserInitiallyLoggedIn: true,
          decodedIdToken_mock: {
            sub: "mock-user-id",
            preferred_username: "wizard",
            email: "wizard@example.com",
            organizations: {} as Record<string, unknown>,
            ...readMockClaims("idToken"),
          },
        }
      : {
          implementation: "real",
          issuerUri: config.issuerUri,
          clientId: config.clientId,
          BASE_URL: config.basepath,
          debugLogs: import.meta.env.VITE_OIDC_SPA_DEBUG === "true" || false,
        },
  );
}

/**
 * Wraps fetch() and automatically attaches a Bearer token when the user is logged in.
 * Use this for all Keycloak API calls.
 */
export const fetchWithAuth: typeof fetch = async (input, init) => {
  const oidc = await getOidc();

  if (oidc.isUserLoggedIn) {
    const accessToken = await oidc.getAccessToken();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    (init ??= {}).headers = headers;
  }

  return fetch(input, init);
};

/**
 * Decoded claims of the current access token, or undefined when they cannot be read
 * (not logged in, or a token that is not a JWT). The signature is not verified — use
 * this only to shape the UI; the server remains the authority on access.
 */
export async function getAccessTokenClaims(): Promise<Record<string, unknown> | undefined> {
  if (isMock) return readMockClaims("accessToken");
  const oidc = await getOidc();
  if (!oidc.isUserLoggedIn) return undefined;
  return decodeJwtPayload(await oidc.getAccessToken());
}
