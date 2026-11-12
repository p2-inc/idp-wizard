import type { Page, Request } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import type { WizardPage } from "./pages/WizardPage";

/**
 * Generic OIDC IdP-initiated wizard.
 *
 * Runs in mock OIDC mode with every Keycloak call intercepted. Verifies the
 * entry point, the initiate-login URL, and that confirmation creates the
 * paired SAML client before the OIDC identity provider, for both realm-wide
 * and organization setup.
 */

const MOCK_OIDC_IMPORT_CONFIG = {
  issuer: "https://test-idp.example.com",
  authorizationUrl: "https://test-idp.example.com/oauth/authorize",
  tokenUrl: "https://test-idp.example.com/oauth/token",
  userInfoUrl: "https://test-idp.example.com/oauth/userinfo",
  jwksUrl: "https://test-idp.example.com/oauth/jwks",
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
    route.fulfill({ json: MOCK_OIDC_IMPORT_CONFIG }),
  );
  await page.route(/\/(admin\/realms\/[^/]+\/clients|idps\/clients)$/, (route) =>
    route.fulfill({ status: clientStatus, json: {} }),
  );
  await page.route(/\/(identity-provider\/instances|orgs\/[^/]+\/idps)$/, (route) =>
    route.fulfill({ status: 201, json: {} }),
  );
  await page.route(/\/mappers$/, (route) => route.fulfill({ status: 201, json: {} }));
}

async function goToConfirmation(page: Page, wizard: WizardPage, search = "") {
  await page.goto(`/wizard/openid/oidc-idp-initiated${search}`);

  await wizard.waitForStep(/Create an OpenID Connect Application/i);
  await wizard.clickNext();

  await wizard.waitForStep(/Configure Identity Provider/i);
  await page
    .getByPlaceholder("https://your-idp.example.com/.well-known/openid-configuration")
    .fill("https://test-idp.example.com/.well-known/openid-configuration");
  await wizard.submitForm(/Fetch Configuration/i);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Client Credentials/i);
  await page.getByPlaceholder("your-client-id").fill("test-client");
  await page.getByPlaceholder("your-client-secret").fill("test-secret");
  await wizard.submitForm(/Save Credentials/i);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Choose the Target Application/i);
  await expect(wizard.nextButton).toBeDisabled();
  await expect(page.getByRole("tab", { name: /SAML application/ })).toHaveCount(0);
  await page.getByPlaceholder("https://app.example.com/").fill("https://app.example.com/home");
  await wizard.submitForm(/^Save$/);
  await expect(wizard.nextButton).toBeEnabled();
  await wizard.clickNext();

  await wizard.waitForStep(/Configure User Access/i);
  await wizard.clickNext();
  await wizard.waitForStep(/Confirmation/i);
}

const SUCCESS = /IdP-initiated OIDC login is configured/i;

test.describe("OIDC IdP-initiated wizard", () => {
  test("is offered as a protocol for generic OpenID", async ({ page }) => {
    await page.goto("/wizard/openid");
    await page.getByRole("button", { name: /OIDC \(IdP-initiated\)/ }).click();
    await expect(page).toHaveURL(/\/wizard\/openid\/oidc-idp-initiated/);
  });

  test("shows the redirect URI and the initiate-login URL", async ({ page, wizard }) => {
    await page.goto("/wizard/openid/oidc-idp-initiated");
    await wizard.waitForStep(/Create an OpenID Connect Application/i);

    const redirect = (await wizard.getCopyBlockValue("Redirect URI")).trim();
    const alias = redirect.match(/\/broker\/(openid-oidc-idp-initiated-\w+)\/endpoint$/)?.[1];
    expect(alias).toBeTruthy();

    const login = (await wizard.getCopyBlockValue("Initiate Login URL")).trim();
    expect(login).toMatch(
      new RegExp(
        `/realms/[^/]+/protocol/saml/clients/idp-initiated-${alias}\\?kc_idp_hint=${alias}$`,
      ),
    );
    expect(login.split("/protocol/")[0]).toBe(redirect.split("/broker/")[0]);
  });

  test("creates the client, then the OIDC identity provider", async ({ page, wizard }) => {
    await mockKeycloak(page);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard);

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(SUCCESS);

    expect(calls.map((c) => c.kind)).toEqual(["client", "idp"]);

    const client = calls[0].request.postDataJSON();
    const idp = calls[1].request.postDataJSON();
    expect(new URL(calls[0].request.url()).pathname).toMatch(/\/admin\/realms\/[^/]+\/clients$/);
    // The organizations endpoint rejects unknown keys, so the body shape is exact.
    expect(Object.keys(client).sort()).toEqual(
      ["attributes", "clientId", "description", "name", "protocol"].sort(),
    );
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

    expect(idp.providerId).toBe("oidc");
    expect(idp.config.clientId).toBe("test-client");
    expect(idp.config.clientSecret).toBe("test-secret");
    expect(idp.config.authorizationUrl).toBe(MOCK_OIDC_IMPORT_CONFIG.authorizationUrl);
    expect(idp.config.tokenUrl).toBe(MOCK_OIDC_IMPORT_CONFIG.tokenUrl);
  });

  test("reuses a client left by an earlier attempt (409)", async ({ page, wizard }) => {
    await mockKeycloak(page, 409);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard);

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(SUCCESS);
    expect(calls.map((c) => c.kind)).toEqual(["client", "idp"]);
  });

  test("stops before creating the IdP when the client cannot be created", async ({
    page,
    wizard,
  }) => {
    await mockKeycloak(page, 403);
    const calls = trackCreates(page);
    await goToConfirmation(page, wizard);

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
    await goToConfirmation(page, wizard, `?org_id=${ORG_ID}`);

    await wizard.confirm(/Create IdP-Initiated Login/i);
    await wizard.waitForSuccess(SUCCESS);

    expect(calls.map((c) => c.kind)).toEqual(["client", "idp"]);
    expect(new URL(calls[0].request.url()).pathname).toMatch(
      new RegExp(`/orgs/${ORG_ID}/idps/clients$`),
    );
    expect(new URL(calls[1].request.url()).pathname).toMatch(
      new RegExp(`/orgs/${ORG_ID}/idps$`),
    );
    expect(calls[1].request.postDataJSON().providerId).toBe("oidc");
  });
});
