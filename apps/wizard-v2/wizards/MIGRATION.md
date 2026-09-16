# Wizard Migration Summary

Migrated from wizard-v1 (per-provider React component trees) to wizard-v2 (declarative JSON definitions rendered by a generic runtime engine).

## Provider inventory

### Generic protocols

| File | Protocol | Metadata input | Notes |
|------|----------|---------------|-------|
| `saml/saml.json` | SAML | URL, file, or manual | Three metadata input options via tabbed form group |
| `openid/oidc.json` | OIDC | Discovery URL or manual | Separate client credentials step |
| `ldap/ldap.json` | LDAP | Manual form entry | Uses `createComponent` + `triggerSync` endpoints (not IDP) |

### SAML providers — URL metadata

| File | Provider | Config overrides | Mapper attributes |
|------|----------|-----------------|-------------------|
| `adfs/saml.json` | ADFS | `nameIDPolicyFormat: persistent`, `wantAuthnRequestsSigned: true`, `signatureAlgorithm: RSA_SHA256`, `xmlSigKeyInfoKeyNameTransformer: CERT_SUBJECT` | MS claim URIs (see below) |
| `aws/saml.json` | AWS SSO | `syncMode: IMPORT` (instead of FORCE) | Standard |
| `cloudflare/saml.json` | Cloudflare | Standard | Standard |
| `cyberark/saml.json` | CyberArk | Standard | Standard |
| `duo/saml.json` | Duo | Standard | Standard |
| `entraid/saml.json` | Microsoft Entra ID | Standard | Standard |
| `onelogin/saml.json` | OneLogin | Standard | LDAP-style (`uid`, `mail`, `givenName`, `sn`) |
| `salesforce/saml.json` | Salesforce | Standard | Standard |

### SAML providers — file upload metadata

| File | Provider | Config overrides | Mapper attributes |
|------|----------|-----------------|-------------------|
| `auth0/saml.json` | Auth0 | Standard | Auth0 claim URIs (see below) |
| `google/saml.json` | Google Workspace | Standard | LDAP-style |
| `jumpcloud/saml.json` | JumpCloud | Standard | LDAP-style |
| `lastpass/saml.json` | LastPass | Standard | Standard |
| `okta/saml.json` | Okta | Standard | `id` for username (see below) |
| `oracle/saml.json` | Oracle | Standard | LDAP-style |
| `pingone/saml.json` | PingOne | Standard | LDAP-style |

### OIDC providers — domain-based discovery

| File | Provider | Discovery URL pattern | Notes |
|------|----------|-----------------------|-------|
| `auth0/oidc.json` | Auth0 | `https://{domain}/.well-known/openid-configuration` | Domain + clientId + clientSecret in one step |
| `salesforce/oidc.json` | Salesforce | `https://{domain}/.well-known/openid-configuration` | Same pattern, different field labels |

### LDAP providers

| File | Provider | Notes |
|------|----------|-------|
| `ldap/ldap.json` | Generic LDAP | Full schema config step, generic DN fields |
| `okta/ldap.json` | Okta LDAP | Okta-specific placeholders, simplified steps (no schema config step) |

## Mapper attribute mappings

### Standard (most providers)
| Keycloak field | attributeName | friendlyName |
|---------------|---------------|--------------|
| username | `username` | `username` |
| email | `email` | `email` |
| firstName | `firstName` | `firstName` |
| lastName | `lastName` | `lastName` |

### LDAP-style (Google, JumpCloud, OneLogin, Oracle, PingOne)
| Keycloak field | attributeName | friendlyName |
|---------------|---------------|--------------|
| username | `uid` | `uid` |
| email | `mail` | `mail` |
| firstName | `givenName` | `givenName` |
| lastName | `sn` | `sn` |

### ADFS (Microsoft claim URIs)
| Keycloak field | attributeName |
|---------------|---------------|
| username | `http://schemas.microsoft.com/2012/12/certificatecontext/field/subjectname` |
| email | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| firstName | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` |
| lastName | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` |

### Auth0 SAML (WS-Federation claim URIs)
| Keycloak field | attributeName |
|---------------|---------------|
| username | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/username` |
| email | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| firstName | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` |
| lastName | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` |

### Okta SAML
| Keycloak field | attributeName | friendlyName |
|---------------|---------------|--------------|
| username | `id` | `id` |
| email | `email` | `email` |
| firstName | `firstName` | `firstName` |
| lastName | `lastName` | `lastName` |

## Provider-specific deviations

### ADFS
- **Config overrides**: Forces persistent NameID format, signed authn requests, RSA_SHA256 signature algorithm, and CERT_SUBJECT key name transformer. These are required for ADFS compatibility.
- **Handled in JSON**: Yes — set in `idpConfig.defaults`.

### AWS SSO
- **Config override**: Uses `syncMode: "IMPORT"` instead of the standard `"FORCE"`. Mapper syncMode also set to `"IMPORT"`.
- **Handled in JSON**: Yes — both in `idpConfig.defaults` and in the mapper `foreach` body.

### Auth0 OIDC / Salesforce OIDC
- **Domain-based discovery**: These providers use a domain field (not a full URL) to construct the OIDC discovery URL. The domain, clientId, and clientSecret are collected in a single form and validated together.
- **Handled in JSON**: Yes — the `validateDomainCredentials` action constructs the discovery URL from `{{form.domain}}`.

### Okta LDAP
- **Auto-fill DN fields**: Wizard-v1 auto-populated baseDn, userBaseDn, and groupBaseDn when the host matched `*.ldap.okta.com`. This is client-side logic that can't be expressed in JSON.
- **Handled in JSON**: Partially — Okta-specific placeholder hints guide the user (e.g. `dc=your-org,dc=okta,dc=com`). Full auto-fill would require a custom block type or a client-side enhancement to the form renderer.
- **Simplified steps**: Wizard-v1 had a separate group mapping step. Removed in v2 since group federation config is rarely needed in the initial setup.

### OneLogin
- **URL regex validation**: Wizard-v1 escaped forward slashes in the ACS URL for display. This was a display-only concern and is not needed in v2 since the copy block handles URL display natively.
- **Handled in JSON**: Not needed.

## Not yet handled (requires executeAction implementation)

The following features are defined in the JSON schema but require the `executeAction` function (currently a stub) to be implemented:

1. **HTTP action execution** — all `importConfig`, `createIdp`, `addMappers` calls
2. **`then` chaining** — e.g. `createIdp → addSamlMappers → clearAlias`
3. **`foreach` iteration** — mapper creation loops
4. **`mergeIntoMetadata`** — storing API responses in wizard state
5. **`saveForm` actions** — saving form values to state (OIDC credential step)
6. **LDAP-specific endpoints** — `testLdapConnection`, `createComponent`, `triggerSync`
7. **`triggerSync` needs component ID** — the sync endpoint requires the ID returned by `createComponent`, which must be passed from the response

## Feature flags not yet migrated

Wizard-v1 supported several feature flags from `config.json` that affect mapper creation:

| Flag | Effect | Status |
|------|--------|--------|
| `emailAsUsername` | Creates an `idpUsername` mapper and remaps the username attribute to use email | Not yet implemented in executeAction |
| `usernameMapperImport` | Sets username mapper syncMode to `"IMPORT"` instead of `"INHERIT"` | Not yet implemented in executeAction |
| `trustEmail` | Sets `trustEmail: true` on the IDP creation payload | Not yet implemented in executeAction |

These flags should be applied at action execution time, not in the JSON definitions, since they are realm-level configuration.

## Template patterns

All wizard JSONs follow one of four repeatable patterns:

### Pattern 1: SAML with URL metadata
Steps: SP info → metadata URL form → attribute mapping → user access → confirm
Used by: ADFS, AWS, Cloudflare, CyberArk, Duo, Entra ID, OneLogin, Salesforce

### Pattern 2: SAML with file upload metadata
Steps: SP info → metadata file form → attribute mapping → user access → confirm
Used by: Auth0, Google, JumpCloud, LastPass, Okta, Oracle, PingOne

### Pattern 3: OIDC with domain discovery
Steps: create app instructions → domain + credentials form → redirect URI → confirm
Used by: Auth0, Salesforce

### Pattern 4: LDAP user federation
Steps: server details → bind credentials → (optional: schema config) → confirm
Used by: Generic LDAP, Okta LDAP

To create a new provider wizard, copy the closest pattern and modify:
1. `id`, `providerId`, `title`, `alias` fields
2. Step instruction text
3. Mapper attribute names in `actions.addSamlMappers.foreach`
4. Any `idpConfig.defaults` overrides
