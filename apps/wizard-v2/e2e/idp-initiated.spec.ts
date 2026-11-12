import type { Page, Request } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import type { WizardPage } from "./pages/WizardPage";

/**
 * Generic SAML IdP-initiated wizard.
 *
 * Runs in mock OIDC mode with every Keycloak call intercepted. Verifies the
 * entry point, the IdP-initiated ACS URL, the target-application choice, and
 * that confirmation creates the client, then the identity provider, then the
 * mappers, for both realm-wide and organization setup.
 */

const MOCK_SAML_IMPORT_CONFIG = {
  entityId: "https://test-idp.example.com",
  singleSignOnServiceUrl: "https://test-idp.example.com/sso/saml",
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

async function mockKeycloak(page: Page, clientStatus = 201) {
  await page.route(/\/(identity-provider|idps)\/import-config$/, (route) =>
    route.fulfill({ json: MOCK_SAML_IMPORT_CONFIG }),
  );
  await page.route(/\/(admin\/realms\/[^/]+\/clients|idps\/clients)$/, (route) =>
    route.fulfill({ status: clientStatus, json: {} }),
  );
  await page.route(/\/(identity-provider\/instances|orgs\/[^/]+\/idps)$/, (route) =>
    route.fulfill({ status: 201, json: {} }),
  );
  await page.route(/\/mappers$/, (route) => route.fulfill({ status: 201, json: {} }));
}

/** Walks the wizard to the confirmation step, choosing the given target app form. */
async function goToConfirmation(
  page: Page,
  wizard: WizardPage,
  target: { tab?: RegExp; placeholder: string; url: string },
  search = "",
) {
  await page.goto(`/wizard/saml/saml-idp-initiated${search}`);

  await wizard.waitForStep(/Create a SAML Application/i);
  await wizard.clickNext();

  await wizard.waitForStep(/Configure Identity Provider Metadata/i);
  await page
    .getByPlaceholder("https://your-idp.example.com/metadata")
    .fill("https://test-idp.example.com/metadata");
  await wizard.submitForm(/Validate URL/i);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Choose the Target Application/i);
  await expect(wizard.nextButton).toBeDisabled();
  if (target.tab) await page.getByRole("tab", { name: target.tab }).click();
  await page.getByPlaceholder(target.placeholder).fill(target.url);
  await wizard.submitForm(/^Save$/);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Configure Attribute Mapping/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Configure User Access/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Confirmation/i);
}

const SUCCESS = /IdP-initiated SAML login is configured/i;

test.describe("SAML IdP-initiated wizard", () => {
  test("is offered as a protocol for generic SAML", async ({ page }) => {
    await page.goto("/wizard/saml");
    await page.getByRole("button", { name: /SAML \(IdP-initiated\)/ }).click();
    await expect(page).toHaveURL(/\/wizard\/saml\/saml-idp-initiated/);
  });

  test("shows the IdP-initiated ACS URL for the paired client", async ({ page, wizard }) => {
    await page.goto("/wizard/saml/saml-idp-initiated");
    await wizard.waitForStep(/Create a SAML Application/i);
    const acs = (await wizard.getCopyBlockValue("ACS URL")).trim();
    expect(acs).toMatch(
      /\/realms\/[^/]+\/broker\/(saml-saml-idp-initiated-\w+)\/endpoint\/clients\/idp-initiated-\1$/,
    );
    await expect(page.getByText("SAML Metadata URL")).toHaveCount(0);
  });

  test("creates the client, then the IdP, then mappers for an OIDC app", async ({
    page,
    wizard,
  }) => {
    await mockKeycloak(page);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard, {
      placeholder: "https://app.example.com/",
      url: "https://app.example.com/home",
    });

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(SUCCESS);

    const kinds = calls.map((c) => c.kind);
    expect(kinds[0]).toBe("client");
    expect(kinds[1]).toBe("idp");
    expect(kinds.slice(2).every((k) => k === "mapper")).toBe(true);
    expect(kinds.length).toBeGreaterThan(2);

    const client = calls[0].request.postDataJSON();
    const idp = calls[1].request.postDataJSON();
    expect(new URL(calls[0].request.url()).pathname).toMatch(/\/admin\/realms\/[^/]+\/clients$/);
    expect(client.protocol).toBe("saml");
    expect(client.clientId).toBe(`idp-initiated-${idp.alias}`);
    expect(client.attributes).toEqual({
      saml_idp_initiated_sso_url_name: `idp-initiated-${idp.alias}`,
      saml_idp_initiated_sso_relay_state: "",
      "saml.force.post.binding": "false",
      saml_assertion_consumer_url_redirect: "https://app.example.com/home",
      saml_assertion_consumer_url_post: "",
      "phasetwo.idp-initiated.alias": idp.alias,
    });
    expect(idp.providerId).toBe("saml");
  });

  test("sends a SAML POST target to the POST ACS attribute", async ({ page, wizard }) => {
    await mockKeycloak(page);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard, {
      tab: /SAML application \(POST\)/,
      placeholder: "https://app.example.com/saml/acs",
      url: "https://sp.example.com/saml/acs",
    });

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(SUCCESS);

    const { attributes } = calls[0].request.postDataJSON();
    expect(attributes["saml.force.post.binding"]).toBe("true");
    expect(attributes.saml_assertion_consumer_url_post).toBe("https://sp.example.com/saml/acs");
    expect(attributes.saml_assertion_consumer_url_redirect).toBe("");
  });

  test("reuses a client left by an earlier attempt (409)", async ({ page, wizard }) => {
    await mockKeycloak(page, 409);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard, {
      tab: /SAML application \(Redirect\)/,
      placeholder: "https://app.example.com/saml/acs",
      url: "https://sp.example.com/saml/acs",
    });

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(SUCCESS);
    expect(calls.map((c) => c.kind).slice(0, 2)).toEqual(["client", "idp"]);
  });

  test("stops before creating the IdP when the client cannot be created", async ({
    page,
    wizard,
  }) => {
    await mockKeycloak(page, 403);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard, {
      placeholder: "https://app.example.com/",
      url: "https://app.example.com/",
    });

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForError(/manage-clients/i);
    expect(calls.map((c) => c.kind)).toEqual(["client"]);
  });

  test("uses the organization endpoints when launched for an organization", async ({
    page,
    wizard,
  }) => {
    await mockKeycloak(page);
    const calls = trackCreates(page);
    await goToConfirmation(
      page,
      wizard,
      { placeholder: "https://app.example.com/", url: "https://app.example.com/" },
      `?org_id=${ORG_ID}`,
    );

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
