import { oidcSpa } from "oidc-spa/react-spa";
import type { RuntimeConfig } from "./runtime-config";

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
          },
        }
      : {
          implementation: "real",
          issuerUri: config.issuerUri,
          clientId: config.clientId,
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
