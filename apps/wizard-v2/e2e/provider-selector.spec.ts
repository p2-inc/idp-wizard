import { test, expect } from "./fixtures/test";

/**
 * Provider selector smoke tests.
 * These cover navigation and UI state only — no wizard step logic yet.
 * Expand once the wizard configuration format is settled.
 */

test.describe("provider selector", () => {
  test.beforeEach(async ({ providerSelector }) => {
    await providerSelector.goto();
  });

  test("renders the provider list", async ({ providerSelector }) => {
    await expect(providerSelector.searchInput).toBeVisible();
    // Placeholder — assert specific providers once list is stable
  });

  test("search filters the provider list", async ({ providerSelector }) => {
    await providerSelector.search("okta");
    await expect(providerSelector.page.getByRole("button", { name: /okta/i })).toBeVisible();
  });

  test("clearing search restores grouped view", async ({ providerSelector }) => {
    await providerSelector.search("okta");
    await providerSelector.clearSearch();
    await expect(providerSelector.page.getByText("Providers")).toBeVisible();
    const genericHeading = providerSelector.page.getByText("Generic", { exact: true });
    await genericHeading.scrollIntoViewIfNeeded();
    await expect(genericHeading).toBeVisible();
  });

  test("help dialog opens and closes", async ({ providerSelector }) => {
    await providerSelector.openHelp();
    await expect(providerSelector.helpDialog).toBeVisible();
    await providerSelector.page.keyboard.press("Escape");
    await expect(providerSelector.helpDialog).not.toBeVisible();
  });
});

test.describe("provider navigation", () => {
  test.beforeEach(async ({ providerSelector }) => {
    await providerSelector.goto();
  });

  test("single-protocol provider navigates directly to wizard", async ({
    providerSelector,
    wizard,
  }) => {
    await providerSelector.selectProvider("ADFS");
    await expect(providerSelector.page).toHaveURL(/\/wizard\/adfs\/saml/);
    await expect(wizard.homeLink).toBeVisible();
  });

  test("multi-protocol provider navigates to protocol picker", async ({
    providerSelector,
  }) => {
    await providerSelector.selectProvider("Okta");
    await expect(providerSelector.page).toHaveURL(/\/wizard\/okta$/);
  });

  test("home link returns to provider selector", async ({
    providerSelector,
    wizard,
  }) => {
    await providerSelector.selectProvider("ADFS");
    await wizard.goHome();
    await expect(providerSelector.page).toHaveURL("/");
  });
});
