import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import {
  defaultOrgId,
  eligibleOrgIds,
  hasRealmIdpRoles,
  realmManagementClientId,
  REQUIRED_ORG_ROLES,
} from "../src/lib/org-access";

/**
 * Org picker defaults (issue #289).
 *
 * "Global (realm-wide)" is only offered to users with realm IdP roles; a user without
 * them who has exactly one eligible org gets that org selected by default.
 *
 * The UI tests run in mock-OIDC mode and set token claims through
 * `window.__WIZARD_MOCK_ID_TOKEN__` (see src/oidc.ts).
 */

const REALM_IDP_ROLES = ["view-identity-providers", "manage-identity-providers"];

const realmAdminClaims = {
  resource_access: { "realm-management": { roles: REALM_IDP_ROLES } },
};

function org(name: string, roles: string[] = REQUIRED_ORG_ROLES) {
  return { name, roles };
}

async function mockIdToken(page: Page, claims: Record<string, unknown>) {
  await page.addInitScript((c) => {
    (globalThis as { __WIZARD_MOCK_ID_TOKEN__?: unknown }).__WIZARD_MOCK_ID_TOKEN__ = c;
  }, claims);
}

// ── Pure logic ───────────────────────────────────────────────────────────────

test.describe("org access logic", () => {
  test("eligible orgs require all org roles", () => {
    expect(
      eligibleOrgIds({
        a: org("A"),
        b: org("B", ["view-identity-providers"]),
        c: {},
      }),
    ).toEqual(["a"]);
  });

  test("realm IdP roles are read from realm-management", () => {
    expect(hasRealmIdpRoles([realmAdminClaims.resource_access], "acme", "acme")).toBe(true);
    expect(
      hasRealmIdpRoles(
        [{ "realm-management": { roles: ["view-identity-providers"] } }],
        "acme",
        "acme",
      ),
    ).toBe(false);
    expect(hasRealmIdpRoles([undefined, undefined], "acme", "acme")).toBe(false);
  });

  test("roles are merged across access and ID token claims", () => {
    expect(
      hasRealmIdpRoles(
        [
          { "realm-management": { roles: ["view-identity-providers"] } },
          { "realm-management": { roles: ["manage-identity-providers"] } },
        ],
        "acme",
        "acme",
      ),
    ).toBe(true);
  });

  test("master-realm users are checked against {targetRealm}-realm", () => {
    expect(realmManagementClientId("master", "acme")).toBe("acme-realm");
    expect(realmManagementClientId("master", "master")).toBe("realm-management");
    expect(realmManagementClientId("acme", "acme")).toBe("realm-management");
    expect(
      hasRealmIdpRoles([{ "acme-realm": { roles: REALM_IDP_ROLES } }], "master", "acme"),
    ).toBe(true);
    expect(
      hasRealmIdpRoles([{ "realm-management": { roles: REALM_IDP_ROLES } }], "master", "acme"),
    ).toBe(false);
  });

  test("defaults to the only eligible org when Global is unavailable", () => {
    expect(defaultOrgId(["a"], false)).toBe("a");
    expect(defaultOrgId(["a"], true)).toBeNull();
    expect(defaultOrgId(["a", "b"], false)).toBeNull();
    expect(defaultOrgId([], false)).toBeNull();
  });
});

// ── Provider selector UI ─────────────────────────────────────────────────────

test.describe("org picker", () => {
  test("org admin with one org gets it selected by default", async ({ page }) => {
    await mockIdToken(page, { organizations: { "org-1": org("Acme") } });
    await page.goto("/");

    await expect(page).toHaveURL(/[?&]org_id=org-1/);
    const picker = page.getByRole("button", { name: "Acme" });
    await expect(picker).toBeVisible();

    await picker.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Realm-wide configuration")).toHaveCount(0);
  });

  test("org admin with one org starts wizards in that org", async ({ page }) => {
    await mockIdToken(page, { organizations: { "org-1": org("Acme") } });
    await page.goto("/");
    await expect(page).toHaveURL(/[?&]org_id=org-1/);

    await page.getByRole("button", { name: /ADFS/i }).click();
    await expect(page).toHaveURL(/\/wizard\/adfs.*[?&]org_id=org-1/);
  });

  test("org admin with several orgs must pick one; Global is not offered", async ({
    page,
  }) => {
    await mockIdToken(page, {
      organizations: { "org-1": org("Acme"), "org-2": org("Globex") },
    });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Select an organization" })).toBeVisible();
    expect(page.url()).not.toContain("org_id=");

    // Choosing a provider before an org opens the picker instead of navigating.
    await page.getByRole("button", { name: /ADFS/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Realm-wide configuration")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/");

    await dialog.getByRole("button", { name: /Globex/ }).click();
    await expect(page).toHaveURL(/[?&]org_id=org-2/);
  });

  test("realm admin keeps Global as the default and can choose it", async ({ page }) => {
    await mockIdToken(page, {
      ...realmAdminClaims,
      organizations: { "org-1": org("Acme") },
    });
    await page.goto("/");

    const picker = page.getByRole("button", { name: "Global (realm-wide)" });
    await expect(picker).toBeVisible();
    expect(page.url()).not.toContain("org_id=");

    await picker.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Realm-wide configuration")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Acme/ })).toBeVisible();
  });

  test("an explicit org_id in the URL is kept", async ({ page }) => {
    await mockIdToken(page, {
      organizations: { "org-1": org("Acme"), "org-2": org("Globex") },
    });
    await page.goto("/?org_id=org-2");

    await expect(page.getByRole("button", { name: "Globex" })).toBeVisible();
    await expect(page).toHaveURL(/[?&]org_id=org-2/);
  });
});
