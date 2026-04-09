import { type Page, type Locator } from "@playwright/test";

/**
 * Page object model for wizard runner and protocol picker views.
 * Expand this as the wizard JSON-driven steps are implemented.
 */
export class WizardPage {
  readonly page: Page;
  readonly homeLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.homeLink = page.getByRole("link", { name: "Providers" });
  }

  async goHome() {
    await this.homeLink.click();
  }

  /** Returns the current URL pathname for assertions. */
  pathname() {
    return new URL(this.page.url()).pathname;
  }
}
