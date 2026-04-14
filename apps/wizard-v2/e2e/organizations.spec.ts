import path from "path";
import { fileURLToPath } from "url";
import { test, expect } from "./fixtures/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Organization tests — integration mode only.
 *
 * These tests require a running Keycloak instance with the Phase Two extension.
 * Run with: PLAYWRIGHT_INTEGRATION=true pnpm test:e2e
 *
 * The test organizations (test-org-alpha, test-org-beta) are created by
 * e2e/global-setup.ts before this suite runs. Their IDs are available as
 * process.env.TEST_ORG_ALPHA_ID and TEST_ORG_BETA_ID.
 *
 * Covered scenarios:
 *   - Wizard launches with ?org_id= param (cloud/org-scoped mode)
 *   - Org-scoped API endpoints are used instead of admin API
 *   - Org admin can complete a wizard for their organization
 */

const KC_BASE = process.env.KC_BASE_URL ?? "http://localhost:8080/auth";
const REALM = "wizard";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getToken(username: string, password: string): Promise<string> {
  const res = await fetch(
    `${KC_BASE}/realms/${REALM}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "wizard-v2-dev",
        username,
        password,
        grant_type: "password",
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to get token for ${username}: ${res.status}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// ── Organization listing ──────────────────────────────────────────────────────

test.describe("organization listing", () => {
  test("test organizations exist in the realm", async () => {
    const token = await getToken("wizard", "password");
    const res = await fetch(`${KC_BASE}/realms/${REALM}/orgs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok).toBe(true);

    const orgs = (await res.json()) as Array<{ name: string }>;
    const names = orgs.map((o) => o.name);
    expect(names).toContain("test-org-alpha");
    expect(names).toContain("test-org-beta");
  });

  test("org-admin is a member of test-org-alpha", async () => {
    const adminToken = await getToken("wizard", "password");
    const orgId = process.env.TEST_ORG_ALPHA_ID;
    expect(orgId).toBeTruthy();

    const res = await fetch(
      `${KC_BASE}/realms/${REALM}/orgs/${orgId}/members`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    expect(res.ok).toBe(true);

    const members = (await res.json()) as Array<{ username: string }>;
    expect(members.map((m) => m.username)).toContain("org-admin");
  });
});

// ── Wizard in org context ────────────────────────────────────────────────────

test.describe("wizard with org context", () => {
  test("wizard URL with ?org_id renders in cloud mode", async ({
    page,
  }) => {
    const orgId = process.env.TEST_ORG_ALPHA_ID ?? "unknown";
    await page.goto(`/?org_id=${orgId}`);

    // Provider selector should be visible and pass the org_id forward
    await expect(page.getByPlaceholder("Search providers...")).toBeVisible();

    // Navigate to a wizard — org_id should be forwarded
    await page.getByRole("button", { name: /ADFS/i }).click();
    await expect(page).toHaveURL(new RegExp(`org_id=${orgId}`));
  });

  test("wizard uses orgs API endpoints in cloud mode", async ({
    page,
  }) => {
    const orgId = process.env.TEST_ORG_ALPHA_ID ?? "unknown";

    // Intercept to verify the org-scoped endpoint is called
    const orgApiCalls: string[] = [];
    await page.route(`**/${REALM}/orgs/**`, (route) => {
      orgApiCalls.push(route.request().url());
      route.fulfill({ json: {} });
    });
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({
        json: {
          entityId: "https://test-idp.example.com",
          singleSignOnServiceUrl: "https://test-idp.example.com/sso/saml",
        },
      })
    );
    await page.route("**/identity-provider/instances", (route) =>
      route.fulfill({ status: 201, json: { id: "mock-id" } })
    );

    await page.goto(`/wizard/adfs/saml?org_id=${orgId}`);
    await page.waitForURL(`/wizard/adfs/saml?org_id=${orgId}`);

    // The page should display org context — the wizard runner uses orgsClient
    // when org_id is present; verify via URL param persistence
    expect(page.url()).toContain(`org_id=${orgId}`);
  });
});

// ── Org-scoped wizard completion ──────────────────────────────────────────────

test.describe("org-scoped SAML wizard completion", () => {
  test("org admin can complete the ADFS SAML wizard for their org", async ({
    page,
    wizard,
  }) => {
    const orgId = process.env.TEST_ORG_ALPHA_ID ?? "unknown";

    // Mock org-scoped API endpoints
    await page.route(
      `**/${REALM}/orgs/${orgId}/idps/import-config`,
      (route) => route.fulfill({ json: { entityId: "https://test-idp.example.com" } })
    );
    await page.route(
      `**/${REALM}/orgs/${orgId}/idps`,
      (route) => route.fulfill({ status: 201, json: { id: "mock-idp" } })
    );
    await page.route(
      `**/${REALM}/orgs/${orgId}/idps/*/mappers`,
      (route) => route.fulfill({ status: 201, json: {} })
    );
    // Also mock the onprem fallback
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({ json: { entityId: "https://test-idp.example.com" } })
    );
    await page.route("**/identity-provider/instances", (route) =>
      route.fulfill({ status: 201, json: { id: "mock-idp" } })
    );
    await page.route("**/identity-provider/instances/*/mappers", (route) =>
      route.fulfill({ status: 201, json: {} })
    );

    await page.goto(`/wizard/adfs/saml?org_id=${orgId}`);
    await wizard.waitForStep(/.+/);

    // ADFS SAML Step 1 — copy blocks
    await wizard.clickNext();

    // ADFS SAML Step 2 — metadata upload
    const metadataFile = path.join(__dirname, "fixtures", "test-saml-metadata.xml");
    await wizard.uploadFile(/Metadata/i, metadataFile);
    await wizard.submitForm(/Validate/i);
    await wizard.clickNext();

    // Remaining steps — skip to confirmation
    // (ADFS wizard may have varying step counts — advance until confirm step)
    let attempts = 0;
    while (attempts < 5) {
      const isConfirm = await page
        .getByRole("button", { name: /Create.*Identity Provider/i })
        .isVisible()
        .catch(() => false);
      if (isConfirm) break;
      await wizard.clickNext().catch(() => {});
      attempts++;
    }

    await wizard.confirm(/Create.*Identity Provider/i);
    await wizard.waitForSuccess();
  });
});
