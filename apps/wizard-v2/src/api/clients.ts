/**
 * Typed API clients for wizard-v2.
 *
 * Two clients are available — which one is used depends on apiMode:
 *
 *   cloud  → orgsClient  — Phase Two Orgs API, org-scoped IDP endpoints
 *                           Base: {serverUrl}  (paths: /{realm}/orgs/{orgId}/...)
 *
 *   onprem → adminClient — Keycloak Admin API, realm-wide IDP endpoints
 *                           Base: {serverUrl}  (paths: /admin/realms/{realm}/...)
 *
 * Both clients automatically attach a Bearer token via the oidc-spa helper.
 * Types are generated from the OpenAPI specs — run `pnpm gen-api` to refresh.
 */
import createClient, { type Middleware } from "openapi-fetch";
import type { paths as OrgsPaths } from "./types/orgs.d.ts";
import type { paths as AdminPaths } from "./types/admin.d.ts";
import { getOidc } from "@/oidc";

/** Middleware that injects the OIDC Bearer token into every request. */
const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const oidc = await getOidc();
    if (oidc.isUserLoggedIn) {
      const token = await oidc.getAccessToken();
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
};

/**
 * Phase Two Orgs API client — use in cloud (org-scoped) mode.
 * Paths match /{realm}/orgs/{orgId}/idps/...
 */
export function createOrgsClient(serverUrl: string) {
  const client = createClient<OrgsPaths>({ baseUrl: serverUrl });
  client.use(authMiddleware);
  return client;
}

/**
 * Keycloak Admin API client — use in onprem (realm-wide) mode.
 * Paths match /admin/realms/{realm}/identity-provider/...
 */
export function createAdminClient(serverUrl: string) {
  const client = createClient<AdminPaths>({ baseUrl: serverUrl });
  client.use(authMiddleware);
  return client;
}

export type OrgsClient = ReturnType<typeof createOrgsClient>;
export type AdminClient = ReturnType<typeof createAdminClient>;
