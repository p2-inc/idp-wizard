import { type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import readline from "readline";

/**
 * Page object for the AWS IAM Identity Center console.
 *
 * Used by saml-capture.ts / oidc-capture.ts to walk through the steps described
 * in saml.json / oidc.json,
 * taking screenshots at each key point so the wizard images can be updated.
 *
 * IAM Identity Center uses SSO/MFA during login, so the script pauses at
 * the login step and waits for the user to complete authentication manually
 * before continuing with the automated navigation.
 *
 * Required environment variables (all optional — the script will prompt if missing):
 *   AWS_CONSOLE_URL   Root console URL (default: https://console.aws.amazon.com)
 *   AWS_SSO_START_URL Your SSO portal URL, e.g. https://your-org.awsapps.com/start/#/?tab=accounts
 *
 * Run with:
 *   cd apps/wizard-v2
 *   npx tsx wizards/aws/saml-capture.ts
 */
export class AwsPage {
  readonly page: Page;
  readonly screenshotsDir: string;
  readonly consoleBase: string;
  private counter = 1;

  constructor(page: Page, screenshotsDir: string) {
    this.page = page;
    this.screenshotsDir = screenshotsDir;
    this.consoleBase =
      process.env["AWS_CONSOLE_URL"] ?? "https://console.aws.amazon.com";

    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Save a screenshot. name is used as the filename prefix. */
  async screenshot(name: string): Promise<string> {
    const padded = String(this.counter++).padStart(2, "0");
    const filename = `${padded}-${name}.png`;
    const filePath = path.join(this.screenshotsDir, filename);
    await this.page.screenshot({ path: filePath, fullPage: true });
    console.log(`  📸  ${filename}`);
    return filePath;
  }

  /** Pause and wait for the user to press Enter in the terminal. */
  async waitForUser(message: string): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    await new Promise<void>((resolve) =>
      rl.question(`\n${message}\nPress Enter to continue... `, () => {
        rl.close();
        resolve();
      })
    );
  }

  // ── Authentication ────────────────────────────────────────────────────────

  /**
   * Opens the AWS console and waits for the user to complete login.
   *
   * IAM Identity Center routes through SSO (TOTP/push/WebAuthn) so we can't
   * automate the credential entry — the browser is left open for manual input.
   */
  async login(startUrl: string): Promise<void> {

    await this.page.goto(startUrl);
    await this.screenshot("aws-login-page");

    await this.waitForUser(
      "Complete AWS login in the browser (SSO portal → MFA → select account/role).\n" +
        "Once you see the AWS Console home, return here."
    );

    await this.screenshot("aws-logged-in");
  }

  // ── IAM Identity Center navigation ───────────────────────────────────────

  /** Navigate to the IAM Identity Center home. */
  async goToIdentityCenter(): Promise<void> {
    await this.page.goto(`${this.consoleBase}/singlesignon/home`);
    await this.page.waitForLoadState("networkidle");
    await this.screenshot("identity-center-home");
  }

  /** Click through to the Applications list. */
  async goToApplications(): Promise<void> {
    await this.page.goto(`${this.consoleBase}/singlesignon/home#/applications`);
    await this.page.waitForLoadState("networkidle");
    await this.screenshot("applications-list");
  }

  // ── Step 1: Create a SAML Application ────────────────────────────────────

  /**
   * Clicks "Add application", selects the custom SAML 2.0 option, and
   * advances past the catalog screen. Returns when the app config form is open.
   */
  async startAddSamlApplication(): Promise<void> {
    // "Add application" button on the Applications list page
    await this.page
      .getByRole("button", { name: /add application/i })
      .click();
    await this.page.waitForLoadState("networkidle");
    await this.screenshot("add-application-catalog");

    // Select "Add custom SAML 2.0 application" (top of the catalog list)
    await this.page
      .getByRole("radio", { name: /custom saml 2\.0/i })
      .click();
    await this.screenshot("custom-saml-selected");

    await this.page.getByRole("button", { name: /next/i }).click();
    await this.page.waitForLoadState("networkidle");
    await this.screenshot("saml-app-config-form");
  }

  // ── Step 2: Configure Application Metadata ───────────────────────────────

  /**
   * Fills the display name and reads the IAM Identity Center metadata URL
   * from the page (the URL the wizard asks users to copy).
   *
   * Also enters the SP details (ACS URL, Entity ID, Metadata URL) that come
   * from your Phase Two / Keycloak instance.
   *
   * @returns the IAM Identity Center SAML metadata file URL shown on the page
   */
  async configureMetadata(opts: {
    displayName: string;
    acsUrl: string;
    entityId: string;
  }): Promise<string> {
    // Display name
    await this.page.getByLabel(/display name/i).fill(opts.displayName);
    await this.screenshot("display-name-entered");

    // Read the IdP metadata URL before we scroll past it
    const metadataLink = this.page
      .getByRole("link", { name: /saml metadata/i })
      .or(this.page.locator("a[href*='metadata']").first());

    const idpMetadataUrl = (await metadataLink.getAttribute("href")) ?? "";
    await this.screenshot("idp-metadata-url-visible");

    // Application ACS URL
    await this.page
      .getByLabel(/application acs url/i)
      .fill(opts.acsUrl);

    // Application SAML audience (Entity ID / SP Entity ID)
    await this.page
      .getByLabel(/application saml audience/i)
      .fill(opts.entityId);

    await this.screenshot("sp-details-entered");

    return idpMetadataUrl;
  }

  // ── Step 3: Configure Attribute Mapping ──────────────────────────────────

  /**
   * Navigates to the attribute mapping section (may be a separate tab or a
   * continuation of the same form) and maps the four standard SAML attributes.
   *
   * AWS Identity Center's attribute mapping UI varies by console version:
   * some show it inline, others on an "Attribute mappings" tab after saving.
   */
  async configureAttributeMapping(): Promise<void> {
    // Try the "Attribute mappings" tab first (post-save flow)
    const tab = this.page.getByRole("tab", { name: /attribute mapping/i });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await this.page.waitForLoadState("networkidle");
    }

    await this.screenshot("attribute-mapping-page");

    // The four standard mappings expected by the wizard
    const mappings: Array<{ subject: string; userAttribute: string }> = [
      { subject: "username", userAttribute: "${user:name}" },
      { subject: "email",    userAttribute: "${user:email}" },
      { subject: "firstName",userAttribute: "${user:givenName}" },
      { subject: "lastName", userAttribute: "${user:familyName}" },
    ];

    // AWS shows a table of rows; add/edit each mapping.
    // Selectors here are best-effort — inspect your console version if they
    // need adjusting (the UI has changed across console generations).
    for (const mapping of mappings) {
      const addBtn = this.page.getByRole("button", { name: /add new attribute mapping|add mapping/i });
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
      }

      // Fill the last empty "Application attribute" input
      const appAttrInputs = this.page.getByPlaceholder(/application attribute/i);
      const count = await appAttrInputs.count();
      if (count > 0) {
        await appAttrInputs.nth(count - 1).fill(mapping.subject);
      }

      // Fill the corresponding "Maps to this value" input
      const valueInputs = this.page.getByPlaceholder(/maps to|value or attribute/i);
      const vcount = await valueInputs.count();
      if (vcount > 0) {
        await valueInputs.nth(vcount - 1).fill(mapping.userAttribute);
      }
    }

    await this.screenshot("attribute-mappings-filled");
  }

  // ── Step 4: Configure User Access ────────────────────────────────────────

  /**
   * Navigates to the "Assign users and groups" section.
   * Pauses so the user can make their selections, then takes a screenshot.
   */
  async configureUserAccess(): Promise<void> {
    // After saving the app there is usually an "Assign users and groups" button
    const assignBtn = this.page.getByRole("button", {
      name: /assign users|assign users and groups/i,
    });
    if (await assignBtn.isVisible().catch(() => false)) {
      await assignBtn.click();
      await this.page.waitForLoadState("networkidle");
    } else {
      // Some console versions have a separate tab
      const tab = this.page.getByRole("tab", { name: /assigned users|users and groups/i });
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await this.page.waitForLoadState("networkidle");
      }
    }

    await this.screenshot("user-access-page");

    await this.waitForUser(
      "Assign the users or groups who should have access, then return here."
    );

    await this.screenshot("user-access-configured");
  }

  // ── Save / Submit ─────────────────────────────────────────────────────────

  async submitApplication(): Promise<void> {
    await this.page
      .getByRole("button", { name: /submit|save changes|next/i })
      .first()
      .click();
    await this.page.waitForLoadState("networkidle");
    await this.screenshot("application-saved");
  }
}
