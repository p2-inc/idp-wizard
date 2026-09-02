import { stripOidcParams, stripOidcParamsFromLocation } from "./oidc-params";

const WIZARD = "https://auth.example.com/realms/demo/wizard";

describe("stripOidcParams", () => {
  it("strips an authorization response delivered in the query string", () => {
    expect(
      stripOidcParams(
        `${WIZARD}?session_state=OM9AhsGCQhFuwqfV&iss=${encodeURIComponent(
          "https://auth.example.com/realms/demo"
        )}&code=1f0c4e2a-0000-4a1b-9c3d-2b7e5a1d4c88`
      )
    ).toBe(WIZARD);
  });

  it("strips an authorization response delivered in the fragment", () => {
    expect(
      stripOidcParams(
        `${WIZARD}/#state=7c1de904&session_state=OM9AhsGC&iss=x&code=b3a17f52`
      )
    ).toBe(`${WIZARD}/`);
  });

  it("strips an error response", () => {
    expect(
      stripOidcParams(`${WIZARD}?error=access_denied&error_description=nope`)
    ).toBe(WIZARD);
  });

  it("matches parameter names case-insensitively, as Keycloak does", () => {
    expect(stripOidcParams(`${WIZARD}?CODE=abc&Session_State=xyz`)).toBe(
      WIZARD
    );
  });

  it("keeps parameters Keycloak does not forbid", () => {
    expect(stripOidcParams(`${WIZARD}?org_id=abc&code=xyz`)).toBe(
      `${WIZARD}?org_id=abc`
    );
  });

  it("leaves a hash route alone", () => {
    expect(stripOidcParams(`${WIZARD}/#/idp/okta`)).toBe(
      `${WIZARD}/#/idp/okta`
    );
  });

  it("leaves a clean URL byte-identical", () => {
    const clean = `${WIZARD}/?a=b%3Ac#/idp/okta`;
    expect(stripOidcParams(clean)).toBe(clean);
  });
});

describe("stripOidcParamsFromLocation", () => {
  const setUrl = (url: string) => window.history.replaceState({}, "", url);
  const APP = "/auth/realms/test/wizard";

  it("clears an authorization response delivered in the query string", () => {
    setUrl(`${APP}?session_state=abc&iss=http%3A%2F%2Fx&code=def`);

    const redirectUri = stripOidcParamsFromLocation();

    expect(window.location.search).toBe("");
    expect(redirectUri).toBe(`http://localhost${APP}`);
  });

  it("preserves a fragment callback so keycloak-js can consume it", () => {
    // response_mode=fragment: clearing this strands the login round-trip in a
    // redirect loop that never reaches the token endpoint.
    const fragment =
      "#state=cb262493&session_state=39f&iss=http%3A%2F%2Fx&code=0960ad66";
    setUrl(`${APP}${fragment}`);

    const redirectUri = stripOidcParamsFromLocation();

    expect(window.location.hash).toBe(fragment);
    expect(redirectUri).toBe(`http://localhost${APP}`);
  });

  it("leaves a clean URL untouched", () => {
    setUrl(`${APP}?org_id=abc`);

    expect(stripOidcParamsFromLocation()).toBe(
      `http://localhost${APP}?org_id=abc`
    );
    expect(window.location.search).toBe("?org_id=abc");
  });
});
