# Testing wizard v2

As of release 0.53, both wizard frontends ship in the same extension JAR: `wizard-v1` (the wizard that has always shipped) and `wizard-v2` (the rewrite). Which one a realm gets is decided per request — there is no separate build, image, or deployment for v2. The compiled-in default is **v1**, so upgrading to 0.53 changes nothing by itself; v2 is opt-in until we flip the default in a later release.

## How version selection works

Selection is most specific first:

1. **Realm attribute** `_providerConfig.wizard.version` — `v1` or `v2`. Wins over everything; lets you flip one realm at a time.
2. **Server-wide default** — the SPI option `--spi-realm-restapi-extension-wizard-default-version`, i.e. the env var `KC_SPI_REALM_RESTAPI_EXTENSION_WIZARD_DEFAULT_VERSION` on the Keycloak container.
3. **Built-in default** — currently `v1`.

An unrecognised value is not an error: the request falls back to the default and Keycloak logs a warning (`requests unsupported wizard version`), so a typo degrades to a working wizard.

The wizard URL is identical for both versions: `https://{keycloak-host}{relative-path}/realms/{realm}/wizard/` (where `{relative-path}` is `KC_HTTP_RELATIVE_PATH`, often `/auth` or empty). The `idp-wizard` client, its redirect URIs, and the `idp-tester` client are also shared, so switching versions never requires client or GitOps changes.

## Flipping a realm to v2

Realm attributes are not exposed in the Keycloak admin console; set them through the admin REST API. **Update the full realm representation** — a partial `PUT` that includes `attributes` replaces the whole attributes map, so always fetch, merge, and put back:

```sh
HOST=https://{keycloak-host}   # include the relative path if the server has one, e.g. .../auth
REALM={realm}

# admin token from the master realm
TOKEN=$(curl -s "$HOST/realms/master/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=admin-cli \
  -d username={admin-user} -d password={admin-password} | jq -r .access_token)

# fetch → merge the attribute → put back
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/admin/realms/$REALM" \
  | jq '.attributes["_providerConfig.wizard.version"] = "v2"' \
  | curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      -d @- "$HOST/admin/realms/$REALM"
```

To roll back, set the value to `"v1"` or delete the key the same way (`jq 'del(.attributes["_providerConfig.wizard.version"])'`). The change is per-request — no restart, no cache to clear; a browser reload is enough.

## What to test

**1. v1 regression (default path).** Before touching any attribute, load `/realms/{realm}/wizard/` on a realm with no version attribute. It must look and behave exactly as before the upgrade — this proves the 0.53 rollout is the no-op it claims to be. Walk at least one wizard through to a created IdP config.

**2. v2 opt-in.** Set the attribute to `v2`, reload the wizard URL. You should get the new UI (Tailwind styling, TanStack router — visually unmistakable from v1). Verify:

- The provider list renders and the realm's branding/config comes through (the config is fetched at runtime from the extension, so broken branding or all-default feature flags means the runtime-config fetch failed — check the browser console for the `keycloak.json` / `config.json` requests).
- Walk one full wizard (e.g. a generic SAML or OIDC provider) to a created IdP, then run the validation step (the `idp-tester` flow).
- Static assets load from the versioned path (`.../wizard/v2/...`) — a 404 storm here means the theme resources are missing from the JAR.
- Deep-link a wizard step and reload the page: client-side routes must be served the SPA shell, not a 404.

**3. Fallback.** Set the attribute to garbage (e.g. `v3`). The wizard must still load (as the default version) and the server log should carry the unsupported-version warning.

**4. Rollback.** Remove the attribute; confirm the realm is back on the default with a reload.

**5. Auth-realm override (if the deployment uses it).** On realms with `_providerConfig.wizard.auth-realm-override` set, confirm login still lands back in the wizard and the wizard configures the *target* realm, not the auth realm — v2 resolves these two separately by design.

## Testing the server-wide default

Only needed when testing the fleet-level flip rather than per-realm opt-in: set `KC_SPI_REALM_RESTAPI_EXTENSION_WIZARD_DEFAULT_VERSION=v2` on the container and restart. Realms with an explicit `v1` attribute must stay on v1 — that's the override working in the protective direction.
