import path from "path";
import { fileURLToPath } from "url";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import type { WizardPage } from "./pages/WizardPage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Wizard completion tests.
 *
 * Tests the full UI flow for each wizard protocol (SAML/OIDC/LDAP) from the
 * provider selector through to the final "created successfully" confirmation.
 *
 * These run in mock OIDC mode (no real Keycloak login required) but the Vite
 * server is started with VITE_OIDC_ISSUER_URI so the wizard runner can resolve
 * API URLs. All Keycloak API calls are intercepted with page.route() so the
 * tests are hermetic and fast.
 *
 * Mocked endpoints:
 *   POST .../identity-provider/import-config           -> validateMetadata
 *   POST .../identity-provider/instances               -> createIdp
 *   POST .../identity-provider/instances/{id}/mappers  -> addMappers
 *   POST .../components                                 -> createComponent (LDAP)
 *   POST .../testLDAPConnection                         -> testLdapConnection
 */

const SAML_METADATA_FILE = path.join(
  __dirname,
  "fixtures",
  "test-saml-metadata.xml"
);

// Mock response bodies
const MOCK_SAML_IMPORT_CONFIG = {
  entityId: "https://test-idp.example.com",
  singleSignOnServiceUrl: "https://test-idp.example.com/sso/saml",
  singleSignOnServiceBinding:
    "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
  nameIDPolicyFormat:
    "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
  signingCertificate: "MIIBkTCB+wIJAJ==",
};

const MOCK_OIDC_IMPORT_CONFIG = {
  issuer: "https://test.auth0.com/",
  authorizationUrl: "https://test.auth0.com/authorize",
  tokenUrl: "https://test.auth0.com/oauth/token",
  userInfoUrl: "https://test.auth0.com/userinfo",
  jwksUrl: "https://test.auth0.com/.well-known/jwks.json",
};

const MOCK_IDP_CREATED = { id: "mock-idp-id", alias: "test-alias" };
const MOCK_MAPPER_CREATED = { id: "mock-mapper-id" };
const MOCK_COMPONENT_CREATED = { id: "mock-component-id" };
const MOCK_LDAP_CONNECTION_OK = { result: "Success" };

// ── SAML wizard ─────────────────────────────────────────────────────────────

test.describe("SAML wizard — Auth0", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Keycloak admin API calls
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({ json: MOCK_SAML_IMPORT_CONFIG })
    );
    await page.route("**/identity-provider/instances", (route) =>
      route.fulfill({ status: 201, json: MOCK_IDP_CREATED })
    );
    await page.route("**/identity-provider/instances/*/mappers", (route) =>
      route.fulfill({ status: 201, json: MOCK_MAPPER_CREATED })
    );
  });

  test("completes the full SAML flow", async ({ page, wizard }) => {
    await page.goto("/wizard/auth0/saml");

    // Step 1 — Create SAML Application (copy blocks, no user input needed)
    await wizard.waitForStep(/Create a SAML Application/i);
    await expect(page.getByText("ACS URL", { exact: true })).toBeVisible();
    await expect(page.getByText("Entity ID", { exact: true })).toBeVisible();
    await wizard.clickNext();

    // Step 2 — Upload Identity Provider Metadata
    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    await wizard.uploadFile(/Metadata File/i, SAML_METADATA_FILE);
    await wizard.submitForm(/Validate File/i);
    await expect(wizard.nextButton).toBeEnabled({ timeout: 5_000 });
    await wizard.clickNext();

    // Step 3 — Configure Attribute Mapping (display-only)
    await wizard.waitForStep(/Configure Attribute Mapping/i);
    await expect(page.getByText("username", { exact: true })).toBeVisible();
    await wizard.clickNext();

    // Step 4 — Configure User Access (display-only)
    await wizard.waitForStep(/Configure User Access/i);
    await wizard.clickNext();

    // Step 5 — Confirmation
    await wizard.waitForStep(/Confirmation/i);
    await wizard.confirm(/Create SAML Identity Provider/i);
    await wizard.waitForSuccess(/SAML Identity Provider created successfully/i);
  });

  test("back navigation returns to previous step", async ({ page, wizard }) => {
    await page.goto("/wizard/auth0/saml");
    await wizard.waitForStep(/Create a SAML Application/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    await wizard.clickBack();
    await wizard.waitForStep(/Create a SAML Application/i);
  });

  test("next is disabled until metadata is validated", async ({
    page,
    wizard,
  }) => {
    await page.goto("/wizard/auth0/saml");
    await wizard.clickNext();
    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    // Next should be disabled or absent before validation
    await expect(wizard.nextButton).toBeDisabled();
  });
});

// ── OIDC wizard ─────────────────────────────────────────────────────────────

test.describe("OIDC wizard — Auth0", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({ json: MOCK_OIDC_IMPORT_CONFIG })
    );
    await page.route("**/identity-provider/instances", (route) =>
      route.fulfill({ status: 201, json: MOCK_IDP_CREATED })
    );
  });

  test("completes the full OIDC flow", async ({ page, wizard }) => {
    await page.goto("/wizard/auth0/oidc");

    // Step 1 — Create Application (informational)
    await wizard.waitForStep(/Create an Application/i);
    await wizard.clickNext();

    // Step 2 — Domain & Credentials
    await wizard.waitForStep(/Domain & Credentials/i);
    await wizard.fillTextField(/Auth0 Domain/i, "test.auth0.com");
    await wizard.fillTextField(/Client ID/i, "mock-client-id");
    await wizard.fillTextField(/Client Secret/i, "mock-client-secret");
    await wizard.submitForm(/Verify & Save/i);
    await expect(wizard.nextButton).toBeEnabled({ timeout: 5_000 });
    await wizard.clickNext();

    // Step 3 — Configure Redirect URI (copy block)
    await wizard.waitForStep(/Configure Redirect URI/i);
    await expect(page.getByText("Redirect URI", { exact: true })).toBeVisible();
    await wizard.clickNext();

    // Step 4 — Confirmation
    await wizard.waitForStep(/Confirmation/i);
    await wizard.confirm(/Create.*Identity Provider/i);
    await wizard.waitForSuccess(/Identity Provider created successfully/i);
  });
});

// ── LDAP wizard ─────────────────────────────────────────────────────────────

test.describe("LDAP wizard — Okta", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/testLDAPConnection", (route) =>
      route.fulfill({ json: MOCK_LDAP_CONNECTION_OK })
    );
    await page.route("**/components", (route) =>
      route.fulfill({ status: 201, json: MOCK_COMPONENT_CREATED })
    );
  });

  test("completes the full LDAP flow", async ({ page, wizard }) => {
    await page.goto("/wizard/okta/ldap");

    // Step 1 — LDAP Server Config + connection test
    await wizard.waitForStep(/Enable LDAP Interface/i);
    await wizard.fillTextField(/LDAP Host/i, "test-org.ldap.okta.com");
    await wizard.fillTextField(/SSL Port/i, "636");
    await wizard.fillTextField(/Base DN/i, "dc=test-org,dc=okta,dc=com");
    await wizard.fillTextField(/Users DN/i, "ou=users,dc=test-org,dc=okta,dc=com");
    await wizard.submitForm(/Test Connection/i);
    await expect(wizard.nextButton).toBeEnabled({ timeout: 5_000 });
    await wizard.clickNext();

    // Step 2 — Bind Credentials + auth test
    await wizard.waitForStep(/LDAP Authentication/i);
    await wizard.fillTextField(/Bind DN/i, "uid=admin,dc=test-org,dc=okta,dc=com");
    await wizard.fillTextField(/Bind Password/i, "mock-password");
    await wizard.submitForm(/Test Authentication/i);
    await expect(wizard.nextButton).toBeEnabled({ timeout: 5_000 });
    await wizard.clickNext();

    // Step 3 — Confirmation
    await wizard.waitForStep(/Confirmation/i);
    await wizard.confirm(/Create LDAP User Federation/i);
    await wizard.waitForSuccess(/LDAP User Federation created successfully/i);
  });
});

// ── Generic SAML wizard ──────────────────────────────────────────────────────

test.describe("Generic SAML wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({ json: MOCK_SAML_IMPORT_CONFIG })
    );
    await page.route("**/identity-provider/instances", (route) =>
      route.fulfill({ status: 201, json: MOCK_IDP_CREATED })
    );
    await page.route("**/identity-provider/instances/*/mappers", (route) =>
      route.fulfill({ status: 201, json: MOCK_MAPPER_CREATED })
    );
  });

  test("navigates to generic SAML from provider selector", async ({
    providerSelector,
    wizard,
    page,
  }) => {
    await providerSelector.goto();
    // The generic SAML row is named "SAML" under the "Generic" heading; anchor
    // the match so provider rows that merely carry a "saml" badge don't match.
    await providerSelector.selectProvider(/^SAML\b/);
    await expect(page).toHaveURL(/\/wizard\/saml\/saml/);
    await wizard.waitForStep(/.+/); // any step title = wizard rendered
  });
});

// ── hideOnLogin depends on IdP scope (#290) ──────────────────────────────────

test.describe("hideOnLogin follows IdP scope", () => {
  // Drives the Auth0 SAML wizard to the confirm step and submits it.
  async function completeAuth0Saml(
    page: Page,
    wizard: WizardPage,
    url: string,
  ) {
    await page.goto(url);
    await wizard.waitForStep(/Create a SAML Application/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Upload Identity Provider Metadata/i);
    await wizard.uploadFile(/Metadata File/i, SAML_METADATA_FILE);
    await wizard.submitForm(/Validate File/i);
    await expect(wizard.nextButton).toBeEnabled({ timeout: 5_000 });
    await wizard.clickNext();
    await wizard.waitForStep(/Configure Attribute Mapping/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Configure User Access/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Confirmation/i);
    await wizard.confirm(/Create SAML Identity Provider/i);
    await wizard.waitForSuccess(/SAML Identity Provider created successfully/i);
  }

  test("realm-wide IdP is created with hideOnLogin=false", async ({
    page,
    wizard,
  }) => {
    let createBody: Record<string, unknown> | null = null;
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({ json: MOCK_SAML_IMPORT_CONFIG })
    );
    await page.route("**/identity-provider/instances", (route) => {
      createBody = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: MOCK_IDP_CREATED });
    });
    await page.route("**/identity-provider/instances/*/mappers", (route) =>
      route.fulfill({ status: 201, json: MOCK_MAPPER_CREATED })
    );

    await completeAuth0Saml(page, wizard, "/wizard/auth0/saml");

    expect(createBody).not.toBeNull();
    expect(createBody!.hideOnLogin).toBe(false);
  });

  test("org-scoped IdP is created with hideOnLogin=true", async ({
    page,
    wizard,
  }) => {
    const orgId = "test-org-id";
    let createBody: Record<string, unknown> | null = null;
    await page.route(`**/orgs/${orgId}/idps/import-config`, (route) =>
      route.fulfill({ json: MOCK_SAML_IMPORT_CONFIG })
    );
    await page.route(`**/orgs/${orgId}/idps`, (route) => {
      createBody = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: MOCK_IDP_CREATED });
    });
    await page.route(`**/orgs/${orgId}/idps/*/mappers`, (route) =>
      route.fulfill({ status: 201, json: MOCK_MAPPER_CREATED })
    );

    await completeAuth0Saml(page, wizard, `/wizard/auth0/saml?org_id=${orgId}`);

    expect(createBody).not.toBeNull();
    expect(createBody!.hideOnLogin).toBe(true);
  });
});

// ── Provider selector -> wizard navigation ───────────────────────────────────

test.describe("all providers load their wizards", () => {
  const singleProtocolProviders: Array<{ id: string; protocol: string }> = [
    { id: "adfs", protocol: "saml" },
    { id: "aws", protocol: "saml" },
    { id: "cloudflare", protocol: "saml" },
    { id: "cyberark", protocol: "saml" },
    { id: "duo", protocol: "saml" },
    { id: "google", protocol: "saml" },
    { id: "jumpcloud", protocol: "saml" },
    { id: "lastpass", protocol: "saml" },
    { id: "entraid", protocol: "saml" },
    { id: "onelogin", protocol: "saml" },
    { id: "oracle", protocol: "saml" },
    { id: "pingone", protocol: "saml" },
    { id: "saml", protocol: "saml" },
    { id: "openid", protocol: "oidc" },
    { id: "ldap", protocol: "ldap" },
  ];

  for (const { id, protocol } of singleProtocolProviders) {
    test(`${id}/${protocol} wizard loads without error`, async ({
      page,
      wizard,
    }) => {
      await page.goto(`/wizard/${id}/${protocol}`);
      // The wizard runner should render a heading — any step title is enough
      await wizard.waitForStep(/.+/);
      // No uncaught errors (Playwright fails on uncaught exceptions by default)
    });
  }

  const multiProtocolProviders = [
    { id: "auth0", protocols: ["saml", "oidc"] },
    { id: "okta", protocols: ["saml", "ldap"] },
    { id: "salesforce", protocols: ["saml", "oidc"] },
  ];

  for (const { id, protocols } of multiProtocolProviders) {
    for (const protocol of protocols) {
      test(`${id}/${protocol} wizard loads without error`, async ({
        page,
        wizard,
      }) => {
        await page.goto(`/wizard/${id}/${protocol}`);
        await wizard.waitForStep(/.+/);
      });
    }
  }
});
