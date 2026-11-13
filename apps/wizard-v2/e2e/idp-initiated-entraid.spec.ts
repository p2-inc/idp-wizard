import type { Page, Request } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import type { WizardPage } from "./pages/WizardPage";

/**
 * Entra ID SAML IdP-initiated wizard.
 *
 * Runs in mock OIDC mode with every Keycloak call intercepted. Verifies the
 * protocol picker entry, the Reply URL shown for the Basic SAML Configuration,
 * and that confirmation creates the client, then the identity provider, then
 * the mappers, with the same client body as the generic IdP-initiated wizard.
 */

const MOCK_SAML_IMPORT_CONFIG = {
  entityId: "https://test-idp.example.com",
  singleSignOnServiceUrl: "https://test-idp.example.com/sso/saml",
  singleSignOnServiceBinding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
  signingCertificate: "MIIBkTCB+wIJAJ==",
};

const METADATA_PLACEHOLDER =
  "https://login.microsoftonline.com/your-tenant-id/federationmetadata/2007-06/federationmetadata.xml";

const CLAIMS = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims";

type Call = { kind: "client" | "idp" | "mapper"; request: Request };

/** Classifies the create requests this wizard makes, in the order sent. */
function trackCreates(page: Page): Call[] {
  const calls: Call[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const path = new URL(request.url()).pathname;
    if (/\/admin\/realms\/[^/]+\/clients$/.test(path) || /\/idps\/clients$/.test(path)) {
      calls.push({ kind: "client", request });
    } else if (/\/identity-provider\/instances$/.test(path) || /\/orgs\/[^/]+\/idps$/.test(path)) {
      calls.push({ kind: "idp", request });
    } else if (/\/mappers$/.test(path)) {
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
  await page.goto("/wizard/entraid/saml-idp-initiated");

  await wizard.waitForStep(/Create an Enterprise Application/i);
  await wizard.clickNext();

  await wizard.waitForStep(/Configure Basic SAML Settings/i);
  await wizard.clickNext();

  await wizard.waitForStep(/Configure Identity Provider Metadata/i);
  await page.getByPlaceholder(METADATA_PLACEHOLDER).fill("https://login.example.com/metadata.xml");
  await wizard.submitForm(/Validate URL/i);
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
  await wizard.waitForStep(/Assign Users and Groups/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Confirmation/i);
}

test.describe("Entra ID SAML IdP-initiated wizard", () => {
  test("is offered as a protocol for Entra ID", async ({ page }) => {
    await page.goto("/wizard/entraid");
    await page.getByRole("button", { name: /SAML \(IdP-initiated\)/ }).click();
    await expect(page).toHaveURL(/\/wizard\/entraid\/saml-idp-initiated/);
  });

  test("shows the IdP-initiated Reply URL and Identifier", async ({ page, wizard }) => {
    await page.goto("/wizard/entraid/saml-idp-initiated");
    await wizard.waitForStep(/Create an Enterprise Application/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Configure Basic SAML Settings/i);

    const reply = (await wizard.getCopyBlockValue("Reply URL")).trim();
    expect(reply).toMatch(
      /\/realms\/[^/]+\/broker\/(entraid-saml-idp-initiated-\w+)\/endpoint\/clients\/idp-initiated-\1$/,
    );
    const entityId = (await wizard.getCopyBlockValue("Identifier (Entity ID)")).trim();
    expect(entityId).toMatch(/\/realms\/[^/]+$/);
    await expect(page.getByText(/Leave "Sign on URL" empty/)).toBeVisible();
  });

  test("creates the client, then the IdP, then the mappers", async ({ page, wizard }) => {
    await mockKeycloak(page);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard);

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(/IdP-initiated SAML login is configured/i);

    await expect.poll(() => calls.filter((c) => c.kind === "mapper").length).toBe(4);
    expect(calls.map((c) => c.kind)).toEqual(["client", "idp", "mapper", "mapper", "mapper", "mapper"]);

    const client = calls[0].request.postDataJSON();
    const idp = calls[1].request.postDataJSON();
    expect(new URL(calls[0].request.url()).pathname).toMatch(/\/admin\/realms\/[^/]+\/clients$/);
    expect(idp.alias).toMatch(/^entraid-saml-idp-initiated-\w+$/);
    expect(idp.providerId).toBe("saml");
    expect(Object.keys(client).sort()).toEqual(["attributes", "clientId", "description", "name", "protocol"]);
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

    const mappers = Object.fromEntries(
      calls
        .filter((c) => c.kind === "mapper")
        .map((c) => {
          const { config } = c.request.postDataJSON();
          return [config["user.attribute"], config["attribute.name"]];
        }),
    );
    expect(mappers).toEqual({
      username: `${CLAIMS}/name`,
      email: `${CLAIMS}/emailaddress`,
      firstName: `${CLAIMS}/givenname`,
      lastName: `${CLAIMS}/surname`,
    });
  });
});
