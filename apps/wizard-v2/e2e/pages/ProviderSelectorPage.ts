import { type Page, type Locator } from "@playwright/test";

/**
 * Page object model for the provider selector (index route).
 * Encapsulates all selectors and interactions for the landing page.
 */
export class ProviderSelectorPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly providerList: Locator;
  readonly helpTrigger: Locator;
  readonly helpDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder("Search providers...");
    this.providerList = page.getByRole("main");
    this.helpTrigger = page.getByRole("button", { name: /where to start/i });
    this.helpDialog = page.getByRole("dialog");
  }

  async goto() {
    await this.page.goto("/");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  async selectProvider(name: string) {
    await this.page.getByRole("button", { name }).click();
  }

  async openHelp() {
    await this.helpTrigger.click();
  }
}
