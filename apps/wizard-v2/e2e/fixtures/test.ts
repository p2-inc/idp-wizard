import { test as base } from "@playwright/test";
import { ProviderSelectorPage } from "../pages/ProviderSelectorPage";
import { WizardPage } from "../pages/WizardPage";

/**
 * Extended test fixture that provides typed page object models.
 * Add more page objects here as wizard pages are built out.
 */
type Fixtures = {
  providerSelector: ProviderSelectorPage;
  wizard: WizardPage;
};

export const test = base.extend<Fixtures>({
  providerSelector: async ({ page }, use) => {
    const providerSelector = new ProviderSelectorPage(page);
    await use(providerSelector);
  },
  wizard: async ({ page }, use) => {
    const wizard = new WizardPage(page);
    await use(wizard);
  },
});

export { expect } from "@playwright/test";
