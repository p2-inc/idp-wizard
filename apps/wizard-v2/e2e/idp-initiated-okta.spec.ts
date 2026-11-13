import type { Page, Request } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import type { WizardPage } from "./pages/WizardPage";

/**
 * Okta SAML IdP-initiated wizard.
 *
 * Runs in mock OIDC mode with every Keycloak call intercepted. Verifies the
 * Okta protocol picker entry, the IdP-initiated Single sign-on URL, and that
 * confirmation creates the client, then the identity provider, then the Okta
 * attribute mappers, with the same client body as the generic wizard.
 */

const MOCK_SAML_IMPORT_CONFIG = {
  entityId: "http://www.okta.com/exk0000000000000000",
  singleSignOnServiceUrl: "https://test-idp.example.com/app/test/sso/saml",
  singleSignOnServiceBinding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
  signingCertificate: "MIIBkTCB+wIJAJ==",
};

const ORG_ID = "00000000-0000-4000-8000-000000000001";

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

/** Walks the Okta wizard to the confirmation step with an OIDC target app. */
async function goToConfirmation(page: Page, wizard: WizardPage, search = "") {
  await page.goto(`/wizard/okta/saml-idp-initiated${search}`);

  await wizard.waitForStep(/Create a New SAML Application/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Configure SAML Service Provider Settings/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Configure Attribute Statements/i);
  await wizard.clickNext();

  await wizard.waitForStep(/Import Okta IdP Metadata/i);
  await expect(wizard.nextButton).toBeDisabled();
  await page
    .getByPlaceholder("https://your-org.okta.com/app/your-app-id/sso/saml/metadata")
    .fill("https://test-idp.example.com/app/test/sso/saml/metadata");
  await wizard.submitForm(/Validate URL/i);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Choose the Target Application/i);
  await expect(wizard.nextButton).toBeDisabled();
  await page.getByPlaceholder("https://app.example.com/").fill("https://app.example.com/home");
  await wizard.submitForm(/^Save$/);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Assign Users and Groups/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Confirmation/i);
}

const SUCCESS = /IdP-initiated SAML login is configured/i;

test.describe("Okta SAML IdP-initiated wizard", () => {
  test("is offered as a protocol for Okta", async ({ page }) => {
    await page.goto("/wizard/okta");
    await page.getByRole("button", { name: /SAML \(IdP-initiated\)/ }).click();
    await expect(page).toHaveURL(/\/wizard\/okta\/saml-idp-initiated/);
    await expect(page.getByRole("heading", { name: /Create a New SAML Application/i })).toBeVisible();
  });

  test("shows the IdP-initiated ACS URL as the Okta Single sign-on URL", async ({
    page,
    wizard,
  }) => {
    await page.goto("/wizard/okta/saml-idp-initiated");
    await wizard.waitForStep(/Create a New SAML Application/i);
    await wizard.clickNext();
    await wizard.waitForStep(/Configure SAML Service Provider Settings/i);

    const sso = (await wizard.getCopyBlockValue("Single sign-on URL")).trim();
    expect(sso).toMatch(
      /\/realms\/[^/]+\/broker\/(okta-saml-idp-initiated-\w+)\/endpoint\/clients\/idp-initiated-\1$/,
    );
    const audience = (await wizard.getCopyBlockValue("Audience URI (SP Entity ID)")).trim();
    expect(audience).toMatch(/\/realms\/[^/]+$/);
    await expect(page.getByText("SAML Metadata URL")).toHaveCount(0);
  });

  test("creates the client, then the IdP, then the Okta mappers", async ({ page, wizard }) => {
    await mockKeycloak(page);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard);

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(SUCCESS);

    const kinds = calls.map((c) => c.kind);
    expect(kinds).toEqual(["client", "idp", "mapper", "mapper", "mapper", "mapper"]);

    const client = calls[0].request.postDataJSON();
    const idp = calls[1].request.postDataJSON();
    expect(new URL(calls[0].request.url()).pathname).toMatch(/\/admin\/realms\/[^/]+\/clients$/);
    expect(idp.alias).toMatch(/^okta-saml-idp-initiated-\w+$/);
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
    expect(idp.providerId).toBe("saml");
    expect(idp.displayName).toBe("Okta SAML (IdP-initiated)");

    const mappers = calls.slice(2).map((c) => c.request.postDataJSON());
    const pairs = mappers.map((m) => `${m.config["attribute.name"]}->${m.config["user.attribute"]}`);
    expect(pairs.sort()).toEqual(
      ["id->username", "email->email", "firstName->firstName", "lastName->lastName"].sort(),
    );
  });

  test("uses the organization endpoints when launched for an organization", async ({
    page,
    wizard,
  }) => {
    await mockKeycloak(page);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard, `?org_id=${ORG_ID}`);

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(SUCCESS);

    expect(new URL(calls[0].request.url()).pathname).toMatch(
      new RegExp(`/orgs/${ORG_ID}/idps/clients$`),
    );
    expect(new URL(calls[1].request.url()).pathname).toMatch(
      new RegExp(`/orgs/${ORG_ID}/idps$`),
    );
  });
});
