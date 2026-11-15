import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, Request } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import {
  evaluateEnableNextWhen,
  parseEnableNextWhen,
} from "../src/lib/enable-next-when";

/**
 * Step 1 of the SCIM wizards: the realm-level "SCIM is enabled" gate.
 *
 * Runs in mock OIDC mode with the org config request intercepted. Verifies
 * that the check is actually sent, and that Continue stays disabled until the
 * realm reports `scimEnabled: true`.
 */

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const ORG_CONFIG = /\/realms\/[^/]+\/orgs\/config$/;

const SCIM_WIZARDS = [
  { route: "/wizard/scim/scim", nextStep: /Choose authentication mode/i },
  { route: "/wizard/okta/scim", nextStep: /Create an Okta SCIM application/i },
  { route: "/wizard/entraid/scim", nextStep: /Create an Entra ID Enterprise Application/i },
];

/** Mocks the org config endpoint and records the requests sent to it. */
async function mockOrgConfig(
  page: Page,
  response: { status?: number; json: unknown },
): Promise<Request[]> {
  const requests: Request[] = [];
  await page.route(ORG_CONFIG, (route) => {
    requests.push(route.request());
    return route.fulfill({ status: response.status ?? 200, json: response.json });
  });
  return requests;
}

async function openGate(page: Page, route: string) {
  await page.goto(`${route}?org_id=${ORG_ID}`);
  await expect(
    page.getByRole("heading", { name: /Verify SCIM is enabled/i }),
  ).toBeVisible();
}

const verifyButton = (page: Page) =>
  page.getByRole("button", { name: "Verify SCIM is enabled", exact: true });

test.describe("SCIM gate", () => {
  for (const { route, nextStep } of SCIM_WIZARDS) {
    test(`${route}: Continue is enabled only after SCIM is verified`, async ({
      page,
      wizard,
    }) => {
      const requests = await mockOrgConfig(page, { json: { scimEnabled: true } });
      await openGate(page, route);

      await expect(wizard.nextButton).toBeDisabled();

      await verifyButton(page).click();
      await expect(wizard.nextButton).toBeEnabled();

      expect(requests).toHaveLength(1);
      expect(requests[0].method()).toBe("GET");
      expect(requests[0].postData()).toBeNull();
      expect(requests[0].headers()["content-type"]).toBeUndefined();
      await expect(page.getByText(/Could not reach the server/i)).toHaveCount(0);

      await wizard.clickNext();
      await wizard.waitForStep(nextStep);
    });

    test(`${route}: Continue stays disabled when SCIM is turned off`, async ({
      page,
      wizard,
    }) => {
      const requests = await mockOrgConfig(page, { json: { scimEnabled: false } });
      await openGate(page, route);

      await verifyButton(page).click();

      await expect(page.getByText(/SCIM is not enabled for this realm/i)).toBeVisible();
      expect(requests).toHaveLength(1);
      await expect(wizard.nextButton).toBeDisabled();
      // The check can be run again, e.g. once an administrator enables SCIM.
      await expect(verifyButton(page)).toBeEnabled();
    });
  }

  test("Continue stays disabled when the config omits scimEnabled", async ({
    page,
    wizard,
  }) => {
    await mockOrgConfig(page, { json: { createAdminUser: true } });
    await openGate(page, "/wizard/scim/scim");

    await verifyButton(page).click();

    await expect(page.getByText(/SCIM is not enabled for this realm/i)).toBeVisible();
    await expect(wizard.nextButton).toBeDisabled();
  });

  test("Continue stays disabled when the config request fails", async ({
    page,
    wizard,
  }) => {
    await mockOrgConfig(page, { status: 500, json: { error: "boom" } });
    await openGate(page, "/wizard/scim/scim");

    await verifyButton(page).click();

    await expect(
      page.getByText(/Could not load the realm's organization configuration/i),
    ).toBeVisible();
    await expect(wizard.nextButton).toBeDisabled();
  });

  test("verifying again after SCIM is enabled opens the gate", async ({
    page,
    wizard,
  }) => {
    let scimEnabled = false;
    await page.route(ORG_CONFIG, (route) => route.fulfill({ json: { scimEnabled } }));
    await openGate(page, "/wizard/scim/scim");

    await verifyButton(page).click();
    await expect(page.getByText(/SCIM is not enabled for this realm/i)).toBeVisible();
    await expect(wizard.nextButton).toBeDisabled();

    scimEnabled = true;
    await verifyButton(page).click();
    await expect(wizard.nextButton).toBeEnabled();
    await expect(page.getByText(/SCIM is not enabled for this realm/i)).toHaveCount(0);
  });
});

test.describe("enableNextWhen expressions", () => {
  test("evaluates dotted paths and fails closed", () => {
    const state = {
      metadataValidated: true,
      credentialsProvided: false,
      metadata: { scimEnabled: true, off: false },
      empty: null,
    };

    expect(evaluateEnableNextWhen("state.metadataValidated", state)).toBe(true);
    expect(evaluateEnableNextWhen("state.credentialsProvided", state)).toBe(false);
    expect(evaluateEnableNextWhen("state.metadata.scimEnabled", state)).toBe(true);
    expect(evaluateEnableNextWhen("state.metadata.off", state)).toBe(false);
    expect(evaluateEnableNextWhen("state.metadata.missing", state)).toBe(false);
    expect(evaluateEnableNextWhen("state.empty.scimEnabled", state)).toBe(false);
    expect(evaluateEnableNextWhen("state.missing.scimEnabled", state)).toBe(false);
    // Inherited properties are not state.
    expect(evaluateEnableNextWhen("state.metadata.constructor", state)).toBe(false);
    // Anything the evaluator can't parse keeps the gate closed.
    expect(evaluateEnableNextWhen("metadataValidated", state)).toBe(false);
    expect(evaluateEnableNextWhen("state.metadataValidated === true", state)).toBe(false);
    expect(evaluateEnableNextWhen("state.", state)).toBe(false);
  });

  test("every wizard JSON uses an expression the runner can evaluate", () => {
    const wizardsDir = join(process.cwd(), "wizards");
    const unsupported: string[] = [];
    let checked = 0;

    for (const provider of readdirSync(wizardsDir, { withFileTypes: true })) {
      if (!provider.isDirectory()) continue;
      const dir = join(wizardsDir, provider.name);
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".json")) continue;
        const definition = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
          steps?: { id: number; enableNextWhen?: string }[];
        };
        for (const step of definition.steps ?? []) {
          if (step.enableNextWhen === undefined) continue;
          checked++;
          if (!parseEnableNextWhen(step.enableNextWhen)) {
            unsupported.push(
              `${provider.name}/${file} step ${step.id}: "${step.enableNextWhen}"`,
            );
          }
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(unsupported).toEqual([]);
  });
});
