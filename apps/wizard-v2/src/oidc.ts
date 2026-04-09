import { oidcSpa } from "oidc-spa/react-spa";

export const {
  bootstrapOidc,
  useOidc,
  getOidc,
  OidcInitializationGate,
} = oidcSpa
  .withAutoLogin()
  .createUtils();

bootstrapOidc(
  import.meta.env.VITE_OIDC_USE_MOCK === "true"
    ? {
        implementation: "mock",
        isUserInitiallyLoggedIn: true,
      }
    : {
        implementation: "real",
        issuerUri: import.meta.env.VITE_OIDC_ISSUER_URI,
        clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
        debugLogs: import.meta.env.VITE_OIDC_SPA_DEBUG === "true" || false,
      },
);

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
