import { type Page } from "@playwright/test";

/**
 * Page object for the Keycloak login screen.
 *
 * Works with both the default Keycloak theme and Phase Two's phasetwo.v2 theme.
 * Uses attribute selectors (name=) rather than IDs so it survives theme changes.
 */
export class KeycloakLoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Wait until the Keycloak login page is visible. */
  async waitForReady() {
    await this.page.waitForURL(/localhost:8080/, { timeout: 15_000 });
    await this.page
      .locator("input[name='username'], #username")
      .waitFor({ timeout: 10_000 });
  }

  async login(username: string, password: string) {
    await this.waitForReady();
    await this.page.locator("input[name='username'], #username").fill(username);
    await this.page.locator("input[name='password'], #password").fill(password);
    await this.page.locator("[type='submit'], #kc-login").click();
    // Wait for redirect back to the app
    await this.page.waitForURL("http://localhost:5173/**", { timeout: 15_000 });
  }
}
