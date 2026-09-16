import { type Page } from "@playwright/test";

/**
 * Page object for the Auth0 Dashboard (manage.auth0.com).
 *
 * Used in external-provider tests that drive Auth0 setup as part of a full
 * end-to-end wizard test. This automates the steps described in the wizard's
 * "Create a SAML Application" and "Create an Application" steps.
 *
 * Required environment variables:
 *   AUTH0_DOMAIN      e.g. your-tenant.auth0.com
 *   AUTH0_EMAIL       dashboard login email
 *   AUTH0_PASSWORD    dashboard login password
 *
 * NOTE: Auth0 dashboard UI changes frequently. If selectors break, check
 * manage.auth0.com and update the locators below.
 */
export class Auth0Page {
  readonly page: Page;
  readonly baseUrl: string;

  constructor(page: Page, _domain?: string) {
    this.page = page;
    // Auth0 dashboard is always at manage.auth0.com (not the tenant domain)
    this.baseUrl = "https://manage.auth0.com";
  }

  // ── Authentication ────────────────────────────────────────────────────────

  async login(email?: string, password?: string) {
    const e = email ?? process.env["AUTH0_EMAIL"];
    const p = password ?? process.env["AUTH0_PASSWORD"];
    if (!e || !p) {
      throw new Error(
        "AUTH0_EMAIL and AUTH0_PASSWORD environment variables are required"
      );
    }

    await this.page.goto(`${this.baseUrl}/`);
    await this.page.getByLabel(/email/i).fill(e);
    await this.page.getByRole("button", { name: /continue/i }).click();
    await this.page.getByLabel(/password/i).fill(p);
    await this.page.getByRole("button", { name: /log in|continue/i }).click();
    await this.page.waitForURL(`${this.baseUrl}/dashboard/**`, {
      timeout: 20_000,
    });
  }

  // ── Application management ────────────────────────────────────────────────

  async goToApplications() {
    await this.page.goto(`${this.baseUrl}/dashboard/applications`);
  }

  async createRegularWebApp(name: string): Promise<void> {
    await this.goToApplications();
    await this.page.getByRole("button", { name: /create application/i }).click();
    await this.page.getByLabel(/name/i).fill(name);
    await this.page
      .getByRole("radio", { name: /regular web applications/i })
      .click();
    await this.page.getByRole("button", { name: /create/i }).click();
    await this.page.waitForURL(/\/applications\//, { timeout: 10_000 });
  }

  async createSamlApp(name: string): Promise<void> {
    await this.goToApplications();
    await this.page.getByRole("button", { name: /create application/i }).click();
    await this.page.getByLabel(/name/i).fill(name);
    // Any app type can have SAML — choose Regular Web App
    await this.page
      .getByRole("radio", { name: /regular web applications/i })
      .click();
    await this.page.getByRole("button", { name: /create/i }).click();
    await this.page.waitForURL(/\/applications\//, { timeout: 10_000 });
    // Enable SAML2 Web App addon
    await this.page.getByRole("tab", { name: /addons/i }).click();
    await this.page.getByRole("button", { name: /saml2 web app/i }).click();
  }

  /** On the SAML2 addon settings modal, enter the ACS URL and Entity ID. */
  async configureSamlAddon(acsUrl: string, entityId: string): Promise<void> {
    await this.page.getByLabel(/application callback url/i).fill(acsUrl);
    await this.page
      .getByLabel(/audience|entity id/i)
      .fill(entityId);
    await this.page.getByRole("button", { name: /enable|save/i }).click();
  }

  /**
   * Returns the SAML metadata download URL for the current application.
   * Must be called after navigating to an application's Addons > SAML2 tab.
   */
  samlMetadataUrl(domain: string, clientId: string): string {
    return `https://${domain}/samlp/metadata/${clientId}`;
  }

  // ── OIDC credentials ─────────────────────────────────────────────────────

  /**
   * Returns the Client ID and Client Secret from the current application page.
   * Assumes you are already on the application's Settings tab.
   */
  async getOidcCredentials(): Promise<{ clientId: string; clientSecret: string }> {
    const clientIdLocator = this.page.getByLabel(/client id/i).first();
    const clientSecretReveal = this.page.getByRole("button", {
      name: /reveal client secret/i,
    });

    await clientSecretReveal.click().catch(() => {});
    const clientSecretLocator = this.page.getByLabel(/client secret/i).first();

    return {
      clientId: (await clientIdLocator.inputValue()) ?? "",
      clientSecret: (await clientSecretLocator.inputValue()) ?? "",
    };
  }

  /** Add a URL to the Allowed Callback URLs list. */
  async addCallbackUrl(url: string): Promise<void> {
    const input = this.page.getByLabel(/allowed callback urls/i);
    const current = await input.inputValue();
    const updated = current ? `${current},${url}` : url;
    await input.fill(updated);
    await this.page.getByRole("button", { name: /save changes/i }).click();
  }
}
