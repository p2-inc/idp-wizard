import path from "path";
import { fileURLToPath } from "url";
import type { Page, Request } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import type { WizardPage } from "./pages/WizardPage";

/**
 * Okta SAML wizard — metadata step.
 *
 * Runs in mock OIDC mode with every Keycloak call intercepted. Verifies that
 * the wizard can be completed with only the Okta Metadata URL, that uploading
 * the metadata XML still works, and that a URL Keycloak can't import shows the
 * validation error and keeps Continue disabled.
 */

const SAML_METADATA_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "test-saml-metadata.xml",
);

const METADATA_URL = "https://test-org.okta.com/app/exk0000000000000000/sso/saml/metadata";
const URL_PLACEHOLDER = "https://your-org.okta.com/app/your-app-id/sso/saml/metadata";

const MOCK_SAML_IMPORT_CONFIG = {
  entityId: "http://www.okta.com/exk0000000000000000",
  singleSignOnServiceUrl: "https://test-org.okta.com/app/test/exk0000000000000000/sso/saml",
  singleSignOnServiceBinding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
  signingCertificate: "MIIBkTCB+wIJAJ==",
};

type Calls = { imports: Request[]; idps: Request[]; mappers: Request[] };

/** Mocks the Keycloak admin API and records the requests the wizard makes. */
async function mockKeycloak(page: Page): Promise<Calls> {
  const calls: Calls = { imports: [], idps: [], mappers: [] };
  await page.route("**/identity-provider/import-config", (route) => {
    calls.imports.push(route.request());
    return route.fulfill({ json: MOCK_SAML_IMPORT_CONFIG });
  });
  await page.route("**/identity-provider/instances", (route) => {
    calls.idps.push(route.request());
    return route.fulfill({ status: 201, json: {} });
  });
  await page.route("**/identity-provider/instances/*/mappers", (route) => {
    calls.mappers.push(route.request());
    return route.fulfill({ status: 201, json: {} });
  });
  return calls;
}

async function goToMetadataStep(page: Page, wizard: WizardPage) {
  await page.goto("/wizard/okta/saml");
  await wizard.waitForStep(/Create a New SAML Application/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Configure SAML Service Provider Settings/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Configure Attribute Mapping/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Import Okta IdP Metadata/i);
  await expect(wizard.nextButton).toBeDisabled();
}

/** From a validated metadata step, creates the IdP on the confirmation step. */
async function finishWizard(wizard: WizardPage) {
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();
  await wizard.waitForStep(/Assign Users and Groups/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Confirmation/i);
  await wizard.confirm(/Create SAML Identity Provider/i);
  await wizard.waitForSuccess();
}

test.describe("Okta SAML wizard — metadata", () => {
  test("offers the Metadata URL first, with file upload as the other tab", async ({
    page,
    wizard,
  }) => {
    await goToMetadataStep(page, wizard);

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveText(["Metadata URL", "Metadata File"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByPlaceholder(URL_PLACEHOLDER)).toBeVisible();
    await expect(page.locator("strong", { hasText: /^Metadata URL$/ })).toBeVisible();
  });

  test("completes using only the Metadata URL", async ({ page, wizard }) => {
    const calls = await mockKeycloak(page);
    await goToMetadataStep(page, wizard);

    await page.getByPlaceholder(URL_PLACEHOLDER).fill(METADATA_URL);
    await wizard.submitForm(/Validate URL/i);
    await finishWizard(wizard);

    expect(calls.imports).toHaveLength(1);
    expect(calls.imports[0].postDataJSON()).toEqual({
      fromUrl: METADATA_URL,
      providerId: "saml",
    });

    expect(calls.idps).toHaveLength(1);
    const idp = calls.idps[0].postDataJSON();
    expect(idp.alias).toMatch(/^okta-saml-\w+$/);
    expect(idp.providerId).toBe("saml");
    expect(idp.config).toMatchObject(MOCK_SAML_IMPORT_CONFIG);

    // The mappers are posted after the success message appears.
    await expect.poll(() => calls.mappers.length).toBe(4);
    const pairs = calls.mappers
      .map((r) => r.postDataJSON())
      .map((m) => `${m.config["attribute.name"]}->${m.config["user.attribute"]}`);
    expect(pairs.sort()).toEqual(
      ["id->username", "email->email", "firstName->firstName", "lastName->lastName"].sort(),
    );
  });

  test("completes using an uploaded metadata file", async ({ page, wizard }) => {
    const calls = await mockKeycloak(page);
    await goToMetadataStep(page, wizard);

    await page.getByRole("tab", { name: "Metadata File" }).click();
    await wizard.uploadFile(/Metadata File/i, SAML_METADATA_FILE);
    await wizard.submitForm(/Validate File/i);
    await finishWizard(wizard);

    expect(calls.imports).toHaveLength(1);
    expect(calls.imports[0].headers()["content-type"]).toContain("multipart/form-data");
    expect(calls.idps).toHaveLength(1);
    expect(calls.idps[0].postDataJSON().config).toMatchObject(MOCK_SAML_IMPORT_CONFIG);
  });

  test("a URL that can't be imported shows the validation error", async ({ page, wizard }) => {
    await page.route("**/identity-provider/import-config", (route) =>
      route.fulfill({ status: 500, body: "<html>Internal error</html>" }),
    );
    await goToMetadataStep(page, wizard);

    await page.getByPlaceholder(URL_PLACEHOLDER).fill("https://test-org.okta.com/not-metadata");
    await wizard.submitForm(/Validate URL/i);

    await expect(page.getByText("Validation failed. Check the URL and try again.")).toBeVisible();
    await expect(wizard.nextButton).toBeDisabled();
  });
});
