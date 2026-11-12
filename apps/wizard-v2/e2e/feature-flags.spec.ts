import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test";

/**
 * Realm feature flags served by the SPI at `/realms/{realm}/wizard/config.json`.
 *
 * `_providerConfig.wizard.enableLdap=false` must hide LDAP everywhere: the generic
 * LDAP provider, the `ldap` protocol of multi-protocol providers (e.g. Okta), and
 * direct links to an LDAP wizard.
 */

async function mockWizardConfig(page: Page, config: Record<string, unknown>) {
  await page.route("**/wizard/config.json", (route) =>
    route.fulfill({ json: config }),
  );
}

/** Navigates and waits until the (mocked) realm config has been delivered. */
async function gotoWithConfig(page: Page, url: string) {
  const configLoaded = page.waitForResponse("**/wizard/config.json");
  await page.goto(url);
  await configLoaded;
}

test.describe("enableLdap=false", () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardConfig(page, { enableLdap: false });
  });

  test("provider list hides the LDAP provider and LDAP badges", async ({
    page,
    providerSelector,
  }) => {
    await gotoWithConfig(page, "/");

    const okta = page.getByRole("button", { name: /okta/i });
    await expect(okta).toBeVisible();
    await expect(okta).toContainText(/saml/i);
    await expect(okta).not.toContainText(/ldap/i);

    await expect(page.getByRole("img", { name: "LDAP", exact: true })).toHaveCount(0);

    await providerSelector.search("ldap");
    await expect(page.getByRole("img", { name: "LDAP", exact: true })).toHaveCount(0);
  });

  test("protocol picker omits LDAP", async ({ page }) => {
    await gotoWithConfig(page, "/wizard/okta");

    await expect(page.getByRole("button", { name: /^SAML/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^OIDC/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^LDAP/ })).toHaveCount(0);
  });

  test("direct link to a provider's LDAP wizard redirects to the protocol picker", async ({
    page,
  }) => {
    await gotoWithConfig(page, "/wizard/okta/ldap");

    await expect(page).toHaveURL(/\/wizard\/okta$/);
    await expect(page.getByRole("button", { name: /^SAML/ })).toBeVisible();
  });

  test("direct link to the generic LDAP wizard redirects to the provider list", async ({
    page,
    providerSelector,
  }) => {
    await gotoWithConfig(page, "/wizard/ldap/ldap");

    await expect(page).toHaveURL(/\/$/);
    await expect(providerSelector.searchInput).toBeVisible();
  });
});

test.describe("enableLdap=true", () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardConfig(page, { enableLdap: true });
  });

  test("provider list and protocol picker offer LDAP", async ({ page }) => {
    await gotoWithConfig(page, "/");

    await expect(page.getByRole("button", { name: /okta/i })).toContainText(/ldap/i);
    await expect(page.getByRole("img", { name: "LDAP", exact: true })).toHaveCount(1);

    await gotoWithConfig(page, "/wizard/okta");
    await expect(page.getByRole("button", { name: /^LDAP/ })).toBeVisible();
  });

  test("LDAP wizard loads", async ({ page, wizard }) => {
    await gotoWithConfig(page, "/wizard/okta/ldap");
    await expect(page).toHaveURL(/\/wizard\/okta\/ldap$/);
    await wizard.waitForStep(/.+/);
  });
});
