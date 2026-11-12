import path from "path";
import { fileURLToPath } from "url";
import type { Page, Request } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import type { WizardPage } from "./pages/WizardPage";

/**
 * PingOne SAML IdP-initiated wizard.
 *
 * Runs in mock OIDC mode with every Keycloak call intercepted. Verifies the
 * protocol picker entry, the IdP-initiated ACS URL, and that confirmation
 * creates the client, then the identity provider, then the mappers.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAML_METADATA_FILE = path.join(__dirname, "fixtures", "test-saml-metadata.xml");

const MOCK_SAML_IMPORT_CONFIG = {
  entityId: "https://test-idp.example.com",
  singleSignOnServiceUrl: "https://test-idp.example.com/sso/saml",
  singleSignOnServiceBinding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
  signingCertificate: "MIIBkTCB+wIJAJ==",
};

type Call = { kind: "client" | "idp" | "mapper"; request: Request };

/** Classifies the create requests this wizard makes, in the order sent. */
function trackCreates(page: Page): Call[] {
  const calls: Call[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const p = new URL(request.url()).pathname;
    if (/\/admin\/realms\/[^/]+\/clients$/.test(p) || /\/idps\/clients$/.test(p)) {
      calls.push({ kind: "client", request });
    } else if (/\/identity-provider\/instances$/.test(p) || /\/orgs\/[^/]+\/idps$/.test(p)) {
      calls.push({ kind: "idp", request });
    } else if (/\/mappers$/.test(p)) {
      calls.push({ kind: "mapper", request });
    }
  });
  return calls;
}

async function mockKeycloak(page: Page) {
  await page.route(/\/(identity-provider|idps)\/import-config$/, (route) =>
    route.fulfill({ json: MOCK_SAML_IMPORT_CONFIG }),
  );
  await page.route(/\/(admin\/realms\/[^/]+\/clients|idps\/clients)$/, (route) =>
    route.fulfill({ status: 201, json: {} }),
  );
  await page.route(/\/(identity-provider\/instances|orgs\/[^/]+\/idps)$/, (route) =>
    route.fulfill({ status: 201, json: {} }),
  );
  await page.route(/\/mappers$/, (route) => route.fulfill({ status: 201, json: {} }));
}

async function goToConfirmation(page: Page, wizard: WizardPage) {
  await page.goto("/wizard/pingone/saml-idp-initiated");

  await wizard.waitForStep(/Create a SAML Application/i);
  await wizard.clickNext();

  await wizard.waitForStep(/Configure Identity Provider Metadata/i);
  await wizard.uploadFile(/Metadata File/i, SAML_METADATA_FILE);
  await wizard.submitForm(/Validate File/i);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Choose the Target Application/i);
  await expect(wizard.nextButton).toBeDisabled();
  await page.getByPlaceholder("https://app.example.com/").fill("https://app.example.com/home");
  await wizard.submitForm(/^Save$/);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Configure Attribute Mapping/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Configure User Access/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Confirmation/i);
}

test.describe("PingOne SAML IdP-initiated wizard", () => {
  test("is offered as a protocol for PingOne", async ({ page }) => {
    await page.goto("/wizard/pingone");
    await page.getByRole("button", { name: /SAML \(IdP-initiated\)/ }).click();
    await expect(page).toHaveURL(/\/wizard\/pingone\/saml-idp-initiated/);
  });

  test("shows the IdP-initiated ACS URL for the paired client", async ({ page, wizard }) => {
    await page.goto("/wizard/pingone/saml-idp-initiated");
    await wizard.waitForStep(/Create a SAML Application/i);
    const acs = (await wizard.getCopyBlockValue("ACS URL")).trim();
    expect(acs).toMatch(
      /\/realms\/[^/]+\/broker\/(pingone-saml-idp-initiated-\w+)\/endpoint\/clients\/idp-initiated-\1$/,
    );
    expect((await wizard.getCopyBlockValue("Entity ID")).trim()).not.toBe("");
    await expect(page.getByText("SAML Metadata URL")).toHaveCount(0);
  });

  test("creates the client, then the IdP, then mappers", async ({ page, wizard }) => {
    await mockKeycloak(page);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard);

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(/IdP-initiated SAML login is configured/i);

    const kinds = calls.map((c) => c.kind);
    expect(kinds).toEqual(["client", "idp", "mapper", "mapper", "mapper", "mapper"]);

    const client = calls[0].request.postDataJSON();
    const idp = calls[1].request.postDataJSON();
    expect(idp.alias).toMatch(/^pingone-saml-idp-initiated-\w+$/);
    expect(idp.providerId).toBe("saml");
    // The organization client endpoint rejects any key outside this exact shape.
    expect(Object.keys(client).sort()).toEqual(
      ["attributes", "clientId", "description", "name", "protocol"].sort(),
    );
    expect(client).toEqual({
      protocol: "saml",
      clientId: `idp-initiated-${idp.alias}`,
      name: "",
      description: `Generated by the IdP wizard for identity provider ${idp.alias}`,
      attributes: {
        saml_idp_initiated_sso_url_name: `idp-initiated-${idp.alias}`,
        saml_idp_initiated_sso_relay_state: "",
        "saml.force.post.binding": "false",
        saml_assertion_consumer_url_redirect: "https://app.example.com/home",
        saml_assertion_consumer_url_post: "",
        "phasetwo.idp-initiated.alias": idp.alias,
      },
    });

    const mapperAttrs = calls
      .slice(2)
      .map((c) => c.request.postDataJSON().config["attribute.name"])
      .sort();
    expect(mapperAttrs).toEqual(["email", "firstName", "lastName", "username"]);
  });
});
