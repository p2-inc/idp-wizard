import path from "path";
import { fileURLToPath } from "url";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Wizard progress survives a page refresh (issue #170).
 *
 * The runner keeps the current step, non-secret form values, and validation
 * state in sessionStorage (src/lib/wizard-session.ts). Secrets are never
 * stored, and the saved progress is removed when the wizard completes or the
 * user leaves it. Mock OIDC mode; Keycloak API calls are intercepted.
 */

const SAML_METADATA_FILE = path.join(
  __dirname,
  "fixtures",
  "test-saml-metadata.xml",
);

const MOCK_SAML_IMPORT_CONFIG = {
  entityId: "https://test-idp.example.com",
  singleSignOnServiceUrl: "https://test-idp.example.com/sso/saml",
  signingCertificate: "MIIBkTCB+wIJAJ==",
};

const MOCK_OIDC_IMPORT_CONFIG = {
  issuer: "https://test.example.com/",
  authorizationUrl: "https://test.example.com/authorize",
  tokenUrl: "https://test.example.com/oauth/token",
};

const DISCOVERY_URL =
  "https://test.example.com/.well-known/openid-configuration";
const CLIENT_SECRET = "s3cr3t-do-not-store";
const BIND_PASSWORD = "b1nd-do-not-store";

/** Everything the tab holds in sessionStorage, as one string. */
function sessionStorageDump(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify({ ...sessionStorage }));
}

function savedProgress(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => sessionStorage.getItem(k), `${key}:state`);
}

async function mockIdpApi(page: Page, importConfig: unknown) {
  await page.route("**/identity-provider/import-config", (route) =>
    route.fulfill({ json: importConfig }),
  );
  await page.route("**/identity-provider/instances", (route) =>
    route.fulfill({ status: 201, json: { id: "mock-idp-id" } }),
  );
  await page.route("**/identity-provider/instances/*/mappers", (route) =>
    route.fulfill({ status: 201, json: { id: "mock-mapper-id" } }),
  );
}

test.describe("Wizard refresh — SAML", () => {
  test.beforeEach(({ page }) => mockIdpApi(page, MOCK_SAML_IMPORT_CONFIG));

  test("resumes at the same step with validation state and metadata", async ({
    page,
    wizard,
  }) => {
    await page.goto("/wizard/auth0/saml");
    await wizard.waitForStep(/Create a SAML Application/i);
    const acsUrl = await page.getByText(/\/broker\/.*\/endpoint/).first().textContent();
    await wizard.clickNext();
    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    await wizard.uploadFile(/Metadata File/i, SAML_METADATA_FILE);
    await wizard.submitForm(/Validate File/i);
    await expect(wizard.nextButton).toBeEnabled();
    await wizard.clickNext();
    await wizard.waitForStep(/Configure Attribute Mapping/i);

    await page.reload();

    // Same step, without passing through step 1 again.
    await wizard.waitForStep(/Configure Attribute Mapping/i);

    // The metadata step is still validated, on the tab that was used.
    await wizard.clickBack();
    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await expect(wizard.nextButton).toBeEnabled();

    // The alias is unchanged, so the values copied into the IdP still apply.
    await wizard.clickBack();
    await wizard.waitForStep(/Create a SAML Application/i);
    await expect(page.getByText(acsUrl!).first()).toBeVisible();

    // The restored metadata is what gets sent on creation.
    await wizard.clickNext();
    await wizard.clickNext();
    await wizard.clickNext();
    await wizard.waitForStep(/Configure User Access/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Confirmation/i);
    const createRequest = page.waitForRequest(
      (r) =>
        r.method() === "POST" && r.url().endsWith("/identity-provider/instances"),
    );
    await wizard.confirm(/Create SAML Identity Provider/i);
    const body = (await createRequest).postDataJSON();
    expect(body.config.entityId).toBe(MOCK_SAML_IMPORT_CONFIG.entityId);
    expect(body.config.signingCertificate).toBe(
      MOCK_SAML_IMPORT_CONFIG.signingCertificate,
    );
    await wizard.waitForSuccess(/SAML Identity Provider created successfully/i);
  });

  test("completing the wizard clears the saved progress", async ({
    page,
    wizard,
  }) => {
    await page.goto("/wizard/auth0/saml");
    await wizard.waitForStep(/Create a SAML Application/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    await wizard.uploadFile(/Metadata File/i, SAML_METADATA_FILE);
    await wizard.submitForm(/Validate File/i);
    await expect(wizard.nextButton).toBeEnabled();
    await expect.poll(() => savedProgress(page, "p2_auth0_saml")).not.toBeNull();

    await wizard.clickNext();
    await wizard.clickNext();
    await wizard.clickNext();
    await wizard.waitForStep(/Confirmation/i);
    await wizard.confirm(/Create SAML Identity Provider/i);
    await wizard.waitForSuccess(/SAML Identity Provider created successfully/i);

    await expect.poll(() => savedProgress(page, "p2_auth0_saml")).toBeNull();

    // A refresh after completion starts a new session at step 1.
    await page.reload();
    await wizard.waitForStep(/Create a SAML Application/i);
  });

  test("leaving the wizard clears the saved progress", async ({
    page,
    wizard,
  }) => {
    await page.goto("/wizard/auth0/saml");
    await wizard.waitForStep(/Create a SAML Application/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    await expect.poll(() => savedProgress(page, "p2_auth0_saml")).not.toBeNull();

    await wizard.goHome();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => savedProgress(page, "p2_auth0_saml")).toBeNull();

    await page.goto("/wizard/auth0/saml");
    await wizard.waitForStep(/Create a SAML Application/i);
  });
});

test.describe("Wizard refresh — OIDC", () => {
  test.beforeEach(({ page }) => mockIdpApi(page, MOCK_OIDC_IMPORT_CONFIG));

  test("restores non-secret inputs and asks for the client secret again", async ({
    page,
    wizard,
  }) => {
    // The tab panel shares the field's label, so target the textbox.
    const discoveryUrl = page.getByRole("textbox", { name: /Discovery URL/i });

    await page.goto("/wizard/openid/oidc");
    await wizard.waitForStep(/Create an Application/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Configure Application/i);
    await discoveryUrl.fill(DISCOVERY_URL);
    await wizard.submitForm(/Fetch Configuration/i);
    await expect(wizard.nextButton).toBeEnabled();
    await wizard.clickNext();
    await wizard.waitForStep(/Client Credentials/i);
    await wizard.fillTextField(/Client ID/i, "mock-client-id");
    await wizard.fillTextField(/Client Secret/i, CLIENT_SECRET);
    await wizard.submitForm(/Save Credentials/i);
    await expect(wizard.nextButton).toBeEnabled();
    await wizard.clickNext();
    await wizard.waitForStep(/Configure User Access/i);

    // The secret is in memory only.
    const stored = await sessionStorageDump(page);
    expect(stored).toContain("mock-client-id");
    expect(stored).not.toContain(CLIENT_SECRET);

    await page.reload();

    // The secret is gone, so the wizard resumes on the step that collects it:
    // the client ID is restored, the secret is empty, and Continue is gated.
    await wizard.waitForStep(/Client Credentials/i);
    await expect(page.getByLabel(/Client ID/i)).toHaveValue("mock-client-id");
    await expect(page.getByLabel(/Client Secret/i)).toHaveValue("");
    await expect(wizard.nextButton).toBeDisabled();

    // Earlier steps keep their values and validation.
    await wizard.clickBack();
    await wizard.waitForStep(/Configure Application/i);
    await expect(discoveryUrl).toHaveValue(DISCOVERY_URL);
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await wizard.clickNext();

    // Re-entering the secret completes the wizard with the restored values.
    await wizard.waitForStep(/Client Credentials/i);
    await wizard.fillTextField(/Client Secret/i, CLIENT_SECRET);
    await wizard.submitForm(/Save Credentials/i);
    await expect(wizard.nextButton).toBeEnabled();
    await wizard.clickNext();
    await wizard.clickNext();
    await wizard.waitForStep(/Confirmation/i);
    const createRequest = page.waitForRequest(
      (r) =>
        r.method() === "POST" && r.url().endsWith("/identity-provider/instances"),
    );
    await wizard.confirm(/Create OIDC Identity Provider/i);
    const body = (await createRequest).postDataJSON();
    expect(body.config.clientId).toBe("mock-client-id");
    expect(body.config.clientSecret).toBe(CLIENT_SECRET);
    expect(body.config.tokenUrl).toBe(MOCK_OIDC_IMPORT_CONFIG.tokenUrl);
    await wizard.waitForSuccess(/created successfully/i);
  });
});

test.describe("Wizard refresh — LDAP", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/testLDAPConnection", (route) =>
      route.fulfill({ json: { result: "Success" } }),
    );
  });

  test("never stores the bind password", async ({ page, wizard }) => {
    await page.goto("/wizard/okta/ldap");
    await wizard.waitForStep(/Enable LDAP Interface/i);
    await wizard.fillTextField(/LDAP Host/i, "test-org.ldap.okta.com");
    await wizard.fillTextField(/SSL Port/i, "636");
    await wizard.fillTextField(/Base DN/i, "dc=test-org,dc=okta,dc=com");
    await wizard.fillTextField(/Users DN/i, "ou=users,dc=test-org,dc=okta,dc=com");
    await wizard.submitForm(/Test Connection/i);
    await expect(wizard.nextButton).toBeEnabled();
    await wizard.clickNext();
    await wizard.waitForStep(/LDAP Authentication/i);
    await wizard.fillTextField(/Bind DN/i, "uid=admin,dc=test-org,dc=okta,dc=com");
    await wizard.fillTextField(/Bind Password/i, BIND_PASSWORD);
    await wizard.submitForm(/Test Authentication/i);
    await expect(wizard.nextButton).toBeEnabled();
    await wizard.clickNext();
    await wizard.waitForStep(/Confirmation/i);

    const stored = await sessionStorageDump(page);
    expect(stored).toContain("test-org.ldap.okta.com");
    expect(stored).not.toContain(BIND_PASSWORD);

    await page.reload();

    // Back on the step that needs the password; the rest is restored.
    await wizard.waitForStep(/LDAP Authentication/i);
    await expect(page.getByLabel(/Bind DN/i)).toHaveValue(
      "uid=admin,dc=test-org,dc=okta,dc=com",
    );
    await expect(page.getByLabel(/Bind Password/i)).toHaveValue("");
    await expect(wizard.nextButton).toBeDisabled();
    await wizard.clickBack();
    await wizard.waitForStep(/Enable LDAP Interface/i);
    await expect(page.getByLabel(/LDAP Host/i)).toHaveValue(
      "test-org.ldap.okta.com",
    );
    await expect(wizard.nextButton).toBeEnabled();
  });
});

test.describe("Wizard refresh — SCIM", () => {
  test("never stores the generated secret, even when the API echoes it", async ({
    page,
    wizard,
  }) => {
    // Echo the request back, as the SCIM config endpoint does.
    let generatedSecret = "";
    await page.route("**/orgs/*/scim", (route) => {
      const body = route.request().postDataJSON();
      generatedSecret = body.auth.shared_secret;
      return route.fulfill({ json: body });
    });

    await page.goto("/wizard/scim/scim?org_id=org-1");
    await wizard.waitForStep(/Verify SCIM is enabled/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Choose authentication mode/i);
    await wizard.submitForm(/Generate token and configure/i);
    await expect(page.getByText("Validated", { exact: true })).toBeVisible();
    await wizard.clickNext();
    await wizard.waitForStep(/Reveal your SCIM credentials/i);
    expect(generatedSecret).not.toBe("");
    await expect(page.getByText(generatedSecret)).toBeVisible();

    const stored = await sessionStorageDump(page);
    expect(stored).toContain("EXTERNAL_SECRET");
    expect(stored).not.toContain(generatedSecret);

    await page.reload();

    // The secret cannot be shown again, so the wizard resumes on the step
    // that generates it.
    await wizard.waitForStep(/Choose authentication mode/i);
    await expect(
      page.getByRole("button", { name: /Generate token and configure/i }),
    ).toBeVisible();
    await expect(wizard.nextButton).toBeDisabled();
  });
});
