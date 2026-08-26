import { type Page } from "@playwright/test";

/**
 * Page object for the Okta Admin Console (your-org.okta.com/admin).
 *
 * Used in external-provider tests that automate Okta setup steps described by
 * the okta/saml.json and okta/ldap.json wizards.
 *
 * Required environment variables:
 *   OKTA_DOMAIN      e.g. your-org.okta.com
 *   OKTA_EMAIL       admin login email
 *   OKTA_PASSWORD    admin login password
 *
 * NOTE: Okta's admin console uses React and Lit and the UI changes between
 * versions. If selectors break, inspect the console at /admin and update.
 */
export class OktaPage {
  readonly page: Page;
  readonly adminBase: string;

  constructor(page: Page, domain?: string) {
    this.page = page;
    const d = domain ?? process.env["OKTA_DOMAIN"] ?? "your-org.okta.com";
    this.adminBase = `https://${d}/admin`;
  }

  // ── Authentication ────────────────────────────────────────────────────────

  async login(email?: string, password?: string) {
    const e = email ?? process.env["OKTA_EMAIL"];
    const p = password ?? process.env["OKTA_PASSWORD"];
    if (!e || !p) {
      throw new Error(
        "OKTA_EMAIL and OKTA_PASSWORD environment variables are required"
      );
    }

    await this.page.goto(`${this.adminBase}/`);
    await this.page.getByLabel(/username/i).fill(e);
    await this.page.getByRole("button", { name: /next/i }).click();
    await this.page.getByLabel(/password/i).fill(p);
    await this.page.getByRole("button", { name: /sign in|verify/i }).click();
    await this.page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 });
  }

  // ── SAML App management ───────────────────────────────────────────────────

  async goToApplications() {
    await this.page.goto(`${this.adminBase}/apps/active`);
  }

  /** Create a new SAML 2.0 application. Returns when on the app config page. */
  async createSamlApp(name: string): Promise<void> {
    await this.goToApplications();
    await this.page
      .getByRole("button", { name: /create app integration/i })
      .click();
    await this.page.getByLabel(/saml 2\.0/i).click();
    await this.page.getByRole("button", { name: /next/i }).click();
    await this.page.getByLabel(/app name/i).fill(name);
    await this.page.getByRole("button", { name: /next/i }).click();
  }

  /** Configure SAML settings (on step 2 of app creation). */
  async configureSamlSettings(acsUrl: string, entityId: string): Promise<void> {
    await this.page.getByLabel(/single sign.?on url/i).fill(acsUrl);
    await this.page.getByLabel(/audience uri|sp entity id/i).fill(entityId);
    await this.page.getByRole("button", { name: /next/i }).click();
    await this.page.getByRole("button", { name: /finish/i }).click();
  }

  /**
   * Returns the metadata URL for the current SAML app.
   * Must be called from the app's "Sign On" tab after creation.
   */
  async getMetadataUrl(): Promise<string> {
    await this.page.getByRole("tab", { name: /sign on/i }).click();
    const link = this.page.getByRole("link", { name: /identity provider metadata/i });
    const href = await link.getAttribute("href");
    return href ?? "";
  }

  // ── LDAP Interface ────────────────────────────────────────────────────────

  async goToDirectoryIntegrations() {
    await this.page.goto(`${this.adminBase}/directory/ldap-integration`);
  }

  /**
   * Enables the LDAP interface if not already enabled.
   * Returns the LDAP host and base DN for use in the wizard.
   */
  async enableLdapInterface(): Promise<{ host: string; baseDn: string }> {
    await this.goToDirectoryIntegrations();

    const enableBtn = this.page.getByRole("button", { name: /enable/i });
    if (await enableBtn.isVisible().catch(() => false)) {
      await enableBtn.click();
    }

    // Read the LDAP host and base DN from the settings page
    const hostEl = this.page.getByLabel(/ldap host/i).or(
      this.page.locator("[data-testid='ldap-host']")
    );
    const baseDnEl = this.page.getByLabel(/base dn/i).or(
      this.page.locator("[data-testid='base-dn']")
    );

    const host = (await hostEl.inputValue().catch(() => "")) ||
      (await hostEl.textContent().catch(() => "")) ||
      "";
    const baseDn = (await baseDnEl.inputValue().catch(() => "")) ||
      (await baseDnEl.textContent().catch(() => "")) ||
      "";

    return { host: host.trim(), baseDn: baseDn.trim() };
  }
}
