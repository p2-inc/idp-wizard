import { test, expect } from "../fixtures/test";
import { Auth0Page } from "./Auth0Page";
import { OktaPage } from "./OktaPage";

/**
 * External provider end-to-end tests.
 *
 * These tests drive the full setup loop: configure the external provider (Auth0,
 * Okta) in its own admin UI, then complete the wizard in our app using the
 * values produced by the provider.
 *
 * !! THESE TESTS REQUIRE REAL CREDENTIALS AND LIVE PROVIDER ACCOUNTS !!
 *
 * Environment variables required (set in .env.local or CI secrets):
 *
 *   Auth0:
 *     AUTH0_DOMAIN      your-tenant.auth0.com
 *     AUTH0_EMAIL       dashboard login email
 *     AUTH0_PASSWORD    dashboard login password
 *
 *   Okta:
 *     OKTA_DOMAIN       your-org.okta.com
 *     OKTA_EMAIL        admin email
 *     OKTA_PASSWORD     admin password
 *
 * Running:
 *   PLAYWRIGHT_INTEGRATION=true AUTH0_EMAIL=... AUTH0_PASSWORD=... AUTH0_DOMAIN=...
 *   pnpm test:e2e --project=chromium e2e/external-providers/
 *
 * CAUTION: These tests create real applications and IDPs in your provider
 * accounts. Clean up manually afterward, or add afterAll teardown below.
 */

const hasAuth0Creds =
  !!process.env["AUTH0_EMAIL"] &&
  !!process.env["AUTH0_PASSWORD"] &&
  !!process.env["AUTH0_DOMAIN"];

const hasOktaCreds =
  !!process.env["OKTA_EMAIL"] &&
  !!process.env["OKTA_PASSWORD"] &&
  !!process.env["OKTA_DOMAIN"];

// ── Auth0 OIDC ───────────────────────────────────────────────────────────────

test.describe("Auth0 OIDC — full loop", () => {
  test.skip(!hasAuth0Creds, "AUTH0_* env vars not set");

  /**
   * Flow:
   * 1. Log into Auth0 dashboard, create a Regular Web App
   * 2. Copy the Client ID, Client Secret, and domain
   * 3. Open the wizard (/wizard/auth0/oidc)
   * 4. Fill in domain + credentials → verify
   * 5. Add the redirect URI back in Auth0
   * 6. Complete the wizard
   */
  test("creates Auth0 OIDC IDP from real credentials", async ({ page, wizard }) => {
    const auth0 = new Auth0Page(page);
    const appName = `playwright-test-${Date.now()}`;

    // Step A: Set up in Auth0
    await auth0.login();
    await auth0.createRegularWebApp(appName);
    const { clientId, clientSecret } = await auth0.getOidcCredentials();
    const domain = process.env["AUTH0_DOMAIN"]!;
    expect(clientId).toBeTruthy();
    expect(clientSecret).toBeTruthy();

    // Step B: Complete wizard
    // Mock IDP creation so we don't actually write to Keycloak in this test
    await page.route("**/identity-provider/instances", (route) =>
      route.fulfill({ status: 201, json: { id: "test-idp" } })
    );
    await page.goto("/wizard/auth0/oidc");
    await wizard.waitForStep(/Create an Application/i);
    await wizard.clickNext();

    await wizard.waitForStep(/Domain & Credentials/i);
    await wizard.fillTextField(/Auth0 Domain/i, domain);
    await wizard.fillTextField(/Client ID/i, clientId);
    await wizard.fillTextField(/Client Secret/i, clientSecret);
    await wizard.submitForm(/Verify & Save/i);
    await expect(page.getByText(/verified/i)).toBeVisible({ timeout: 10_000 });
    await wizard.clickNext();

    // Step C: Copy redirect URI and add it back in Auth0
    await wizard.waitForStep(/Configure Redirect URI/i);
    const redirectUriEl = page.locator("[data-copy-value]").first();
    const redirectUri = (await redirectUriEl.getAttribute("data-copy-value")) ?? "";
    if (redirectUri) {
      // Open Auth0 in a second page to avoid losing wizard state
      const auth0Page2 = await page.context().newPage();
      const auth02 = new Auth0Page(auth0Page2);
      await auth02.addCallbackUrl(redirectUri);
      await auth0Page2.close();
    }
    await wizard.clickNext();

    // Step D: Confirm
    await wizard.waitForStep(/Confirmation/i);
    await wizard.confirm(/Create.*Identity Provider/i);
    await wizard.waitForSuccess();
  });
});

// ── Auth0 SAML ───────────────────────────────────────────────────────────────

test.describe("Auth0 SAML — full loop", () => {
  test.skip(!hasAuth0Creds, "AUTH0_* env vars not set");

  /**
   * Flow:
   * 1. Log into Auth0 dashboard, create a SAML app with ACS URL + Entity ID
   * 2. Download the metadata file
   * 3. Upload it in the wizard
   * 4. Complete the wizard
   */
  test("creates Auth0 SAML IDP from real metadata", async ({ page, wizard }) => {
    const auth0 = new Auth0Page(page);
    const appName = `playwright-saml-${Date.now()}`;

    // Step A: Get SP values from wizard (we need ACS URL and Entity ID first)
    // Navigate to step 1 to read the copy blocks
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({ json: {} })
    );
    await page.route("**/identity-provider/instances", (route) =>
      route.fulfill({ status: 201, json: { id: "test-idp" } })
    );

    await page.goto("/wizard/auth0/saml");
    await wizard.waitForStep(/Create a SAML Application/i);

    // Read the ACS URL and Entity ID from the wizard
    const acsUrl =
      (await page.locator("[data-copy-label='ACS URL']").textContent()) ?? "";
    const entityId =
      (await page.locator("[data-copy-label='Entity ID']").textContent()) ?? "";

    // Step B: Create app in Auth0 and configure SAML with these values
    await auth0.login();
    await auth0.createSamlApp(appName);
    await auth0.configureSamlAddon(acsUrl.trim(), entityId.trim());

    // Auth0 metadata download URL — use page.goto to download
    const domain = process.env["AUTH0_DOMAIN"]!;
    const metadataRes = await page.goto(
      `https://${domain}/samlp/metadata/${appName}`
    );
    const metadataXml = await metadataRes?.text();
    expect(metadataXml).toContain("EntityDescriptor");

    // Write metadata to a temp file for upload
    const { writeFileSync } = await import("fs");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const tmpFile = join(tmpdir(), `auth0-metadata-${Date.now()}.xml`);
    writeFileSync(tmpFile, metadataXml ?? "");

    // Step C: Return to wizard and complete
    await page.goto("/wizard/auth0/saml");
    await wizard.waitForStep(/Create a SAML Application/i);
    await wizard.clickNext();

    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    await wizard.uploadFile(/Metadata File/i, tmpFile);
    await wizard.submitForm(/Validate File/i);
    await wizard.clickNext();

    await wizard.waitForStep(/Configure Attribute Mapping/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Configure User Access/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Confirmation/i);
    await wizard.confirm(/Create SAML Identity Provider/i);
    await wizard.waitForSuccess();
  });
});

// ── Okta SAML ────────────────────────────────────────────────────────────────

test.describe("Okta SAML — full loop", () => {
  test.skip(!hasOktaCreds, "OKTA_* env vars not set");

  test("creates Okta SAML IDP from real metadata URL", async ({
    page,
    wizard,
  }) => {
    const okta = new OktaPage(page);
    const appName = `playwright-saml-${Date.now()}`;

    // Mock final IDP creation in Keycloak
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({ json: { entityId: "https://test" } })
    );
    await page.route("**/identity-provider/instances", (route) =>
      route.fulfill({ status: 201, json: { id: "test-idp" } })
    );

    // Get SP values from wizard step 1
    await page.goto("/wizard/okta/saml");
    await wizard.waitForStep(/.+/);
    const acsUrl =
      (await page.locator("[data-copy-label='ACS URL']").textContent())?.trim() ?? "";
    const entityId =
      (await page.locator("[data-copy-label='Entity ID']").textContent())?.trim() ?? "";

    // Set up app in Okta
    await okta.login();
    await okta.createSamlApp(appName);
    await okta.configureSamlSettings(acsUrl, entityId);
    const metadataUrl = await okta.getMetadataUrl();
    expect(metadataUrl).toContain("metadata");

    // Return to wizard — use metadata URL input if available, otherwise file
    await page.goto("/wizard/okta/saml");
    await wizard.waitForStep(/.+/);
    await wizard.clickNext();

    // Try to use URL input first
    const urlInput = page.getByLabel(/metadata url/i);
    if (await urlInput.isVisible().catch(() => false)) {
      await urlInput.fill(metadataUrl);
      await wizard.submitForm(/validate url/i);
    } else {
      // Fall back to file upload — download metadata first
      const metaRes = await page.request.get(metadataUrl);
      const xml = await metaRes.text();
      const { writeFileSync } = await import("fs");
      const { tmpdir } = await import("os");
      const { join } = await import("path");
      const tmp = join(tmpdir(), `okta-metadata-${Date.now()}.xml`);
      writeFileSync(tmp, xml);
      await wizard.uploadFile(/metadata/i, tmp);
      await wizard.submitForm(/validate/i);
    }

    await wizard.clickNext();
    // Navigate remaining steps to confirmation
    for (let i = 0; i < 3; i++) {
      const done = await page
        .getByRole("button", { name: /Create.*Identity Provider/i })
        .isVisible()
        .catch(() => false);
      if (done) break;
      await wizard.clickNext().catch(() => {});
    }
    await wizard.confirm(/Create.*Identity Provider/i);
    await wizard.waitForSuccess();
  });
});
