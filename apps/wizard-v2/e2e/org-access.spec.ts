import { test, expect } from "./fixtures/test";
import type { Page } from "@playwright/test";
import { listOrgOptions, realmIdpAccess } from "../src/lib/org-access";

/**
 * Which scope (organization vs. Global/realm-wide) a user may configure identity
 * providers in — see src/lib/org-access.ts and issue #287.
 *
 * The UI tests run in mock OIDC mode and set ID-token claims through
 * `window.__WIZARD_MOCK_ID_TOKEN__` (see src/oidc.ts). The mock access token is opaque,
 * so realm roles come from the ID token's `resource_access`.
 */

const IDP_ROLES = ["view-identity-providers", "manage-identity-providers"];
const REALM_ADMIN = { resource_access: { "realm-management": { roles: IDP_ROLES } } };
const NO_REALM_ROLES = { resource_access: { account: { roles: ["view-profile"] } } };

async function signInAs(page: Page, idToken: Record<string, unknown>) {
  await page.addInitScript((c) => {
    (globalThis as { __WIZARD_MOCK_ID_TOKEN__?: unknown }).__WIZARD_MOCK_ID_TOKEN__ = c;
  }, idToken);
}

// ── Pure rules ─────────────────────────────────────────────────────────────

test.describe("org access rules", () => {
  test("an org needs only the identity-provider roles", () => {
    const [idpOnly, orgOnly, none] = listOrgOptions({
      a: { name: "Acme", roles: IDP_ROLES },
      b: { roles: ["view-organization", "manage-organization", "view-identity-providers"] },
      c: {},
    });
    expect(idpOnly).toEqual({ id: "a", name: "Acme", missingRoles: [] });
    expect(orgOnly).toEqual({ id: "b", name: "b", missingRoles: ["manage-identity-providers"] });
    expect(none.missingRoles).toEqual(IDP_ROLES);
    expect(listOrgOptions(undefined)).toEqual([]);
  });

  test("realm access is unknown only when no token could be read", () => {
    const admin = REALM_ADMIN.resource_access;
    expect(realmIdpAccess([admin, undefined], "demo", "demo")).toBe("granted");
    expect(realmIdpAccess([undefined, admin], "demo", "demo")).toBe("granted");
    // A readable access token without client roles is a real "no".
    expect(realmIdpAccess([{}, undefined], "demo", "demo")).toBe("denied");
    expect(
      realmIdpAccess([NO_REALM_ROLES.resource_access, undefined], "demo", "demo"),
    ).toBe("denied");
    expect(realmIdpAccess([admin, undefined], "master", "demo")).toBe("denied");
    expect(realmIdpAccess([undefined, undefined], "demo", "demo")).toBe("unknown");
  });
});

// ── Provider selector ──────────────────────────────────────────────────────

test.describe("org picker", () => {
  test("org admin with only identity-provider roles is scoped to their org (#287)", async ({
    page,
    providerSelector,
  }) => {
    await signInAs(page, {
      ...NO_REALM_ROLES,
      organizations: { "org-a": { name: "Acme", roles: IDP_ROLES } },
    });
    await providerSelector.goto();

    // The only usable org is selected — not Global.
    await expect(page).toHaveURL(/\?org_id=org-a$/);
    await page.getByRole("button", { name: "Acme" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /^Global/ })).toBeDisabled();
    await expect(dialog.getByText(/Requires the realm roles/)).toBeVisible();
    await page.keyboard.press("Escape");

    await providerSelector.selectProvider("ADFS");
    await expect(page).toHaveURL(/\/wizard\/adfs\/saml\?org_id=org-a$/);
  });

  test("orgs missing roles are listed but disabled, with the missing roles named", async ({
    page,
    providerSelector,
  }) => {
    await signInAs(page, {
      ...REALM_ADMIN,
      organizations: {
        "org-a": { name: "Acme", roles: IDP_ROLES },
        "org-b": { name: "Beta", roles: ["view-identity-providers"] },
      },
    });
    await providerSelector.goto();

    // A realm admin still starts on Global.
    await page.getByRole("button", { name: "Global (realm-wide)" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /^Global/ })).toBeEnabled();
    await expect(dialog.getByRole("button", { name: /^Acme/ })).toBeEnabled();
    const beta = dialog.getByRole("button", { name: /^Beta/ });
    await expect(beta).toBeDisabled();
    await expect(beta).toContainText("Missing organization role: manage-identity-providers");
  });

  test("several orgs and no realm roles: an org must be chosen first", async ({
    page,
    providerSelector,
  }) => {
    await signInAs(page, {
      ...NO_REALM_ROLES,
      organizations: {
        "org-a": { name: "Acme", roles: IDP_ROLES },
        "org-c": { name: "Gamma", roles: IDP_ROLES },
      },
    });
    await providerSelector.goto();

    await expect(page.getByRole("button", { name: "Select an organization" })).toBeVisible();
    await providerSelector.selectProvider("ADFS");
    // Picking a provider opens the org picker instead of starting a Global wizard.
    await expect(page).toHaveURL(/\/$/);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Gamma/ }).click();
    await expect(page).toHaveURL(/\?org_id=org-c$/);

    await providerSelector.selectProvider("ADFS");
    await expect(page).toHaveURL(/\/wizard\/adfs\/saml\?org_id=org-c$/);
  });

  test("no usable org and no realm roles: explains the missing permissions", async ({
    page,
    providerSelector,
  }) => {
    await signInAs(page, {
      ...NO_REALM_ROLES,
      organizations: { "org-b": { name: "Beta", roles: [] } },
    });
    await providerSelector.goto();
    await expect(page.getByRole("alert")).toContainText(
      "You can't configure identity providers",
    );
  });

  test("no readable realm roles leaves the default Global behavior alone", async ({
    page,
    providerSelector,
  }) => {
    // Opaque mock access token and no resource_access in the ID token: "unknown".
    await signInAs(page, {
      organizations: { "org-a": { name: "Acme", roles: IDP_ROLES } },
    });
    await providerSelector.goto();
    await expect(page.getByRole("button", { name: "Global (realm-wide)" })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});

// ── Wizard route gate ──────────────────────────────────────────────────────

test.describe("wizard without org_id", () => {
  test("blocks a user without realm roles instead of calling the admin API", async ({
    page,
  }) => {
    await signInAs(page, {
      ...NO_REALM_ROLES,
      organizations: { "org-a": { name: "Acme", roles: IDP_ROLES } },
    });
    const adminCalls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/admin/realms/")) adminCalls.push(r.url());
    });

    await page.goto("/wizard/adfs/saml");
    await expect(page.getByRole("heading", { name: "Pick an organization" })).toBeVisible();
    await page.getByRole("link", { name: "Choose an organization" }).click();
    await expect(page).toHaveURL(/\?org_id=org-a$/);
    expect(adminCalls).toEqual([]);
  });

  test("still runs for a realm admin", async ({ page, wizard }) => {
    await signInAs(page, REALM_ADMIN);
    await page.goto("/wizard/adfs/saml");
    await wizard.waitForStep(/.+/);
    await expect(page.getByRole("heading", { name: "Pick an organization" })).toHaveCount(0);
  });
});
