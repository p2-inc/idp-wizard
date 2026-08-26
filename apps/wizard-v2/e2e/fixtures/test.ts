import { test as base } from "@playwright/test";
import { ProviderSelectorPage } from "../pages/ProviderSelectorPage";
import { WizardPage } from "../pages/WizardPage";
import { KeycloakLoginPage } from "../pages/KeycloakLoginPage";

/**
 * Extended test fixture that provides typed page object models.
 *
 * Fixtures:
 *   providerSelector   — landing page (provider list, search, help dialog)
 *   wizard             — wizard runner + protocol picker
 *   keycloakLogin      — Keycloak login page (integration tests only)
 *   kcToken            — real Keycloak access token via direct grant (requires KC running)
 *   withRealKcAuth     — intercepts KC admin API requests and injects a real token;
 *                        lets the request through to the real Keycloak instead of mocking.
 *                        Use this in tests that need real API responses.
 */

const KC_BASE = process.env.KC_BASE_URL ?? "http://localhost:8080/auth";
const KC_REALM = "wizard";
const KC_CLIENT_ID = process.env.VITE_OIDC_CLIENT_ID ?? "wizard-v2-dev";
const KC_USERNAME = process.env.KC_WIZARD_USER ?? "wizard";
const KC_PASSWORD = process.env.KC_WIZARD_PASS ?? "password";

/** Fetch a real Keycloak access token for the wizard user via direct grant. */
async function fetchKcToken(): Promise<string> {
  const res = await fetch(
    `${KC_BASE}/realms/${KC_REALM}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: KC_CLIENT_ID,
        username: KC_USERNAME,
        password: KC_PASSWORD,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Keycloak token: ${res.status} ${await res.text()}`
    );
  }
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

type Fixtures = {
  providerSelector: ProviderSelectorPage;
  wizard: WizardPage;
  keycloakLogin: KeycloakLoginPage;
  /** Real KC access token obtained via direct grant. Requires Keycloak to be running. */
  kcToken: string;
  /**
   * Installs a route handler that intercepts Keycloak admin API calls and
   * replaces the Authorization header with a real token, then forwards the
   * request to Keycloak. Use this instead of page.route() response mocks when
   * you want real API responses.
   */
  withRealKcAuth: void;
};

export const test = base.extend<Fixtures>({
  providerSelector: async ({ page }, use) => {
    await use(new ProviderSelectorPage(page));
  },
  wizard: async ({ page }, use) => {
    await use(new WizardPage(page));
  },
  keycloakLogin: async ({ page }, use) => {
    await use(new KeycloakLoginPage(page));
  },

  kcToken: async ({}, use) => {
    const token = await fetchKcToken();
    await use(token);
  },

  withRealKcAuth: async ({ page, kcToken }, use) => {
    // Intercept all requests to the Keycloak admin API and replace the
    // Authorization header with the real token, then continue to the real server.
    await page.route(`${KC_BASE}/admin/**`, async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          Authorization: `Bearer ${kcToken}`,
        },
      });
    });
    await use();
  },
});

export { expect } from "@playwright/test";
