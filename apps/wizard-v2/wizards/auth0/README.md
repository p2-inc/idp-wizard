# Auth0

## SAML

### Mapper attributes

Auth0 sends SAML attributes as WS-Federation claim URIs:

| Keycloak field | Auth0 claim URI |
|---------------|-----------------|
| username | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/username` |
| email | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| firstName | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` |
| lastName | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` |

These come from the Auth0 SAML2 Web App addon defaults. Users can customize them in Auth0 but the above are the out-of-box values.

### Metadata input

Auth0 provides SAML metadata as a downloadable file (not a URL), so this wizard uses file upload.

## OIDC

### Domain-based discovery

Auth0 OIDC uses the tenant domain to construct the discovery URL: `https://{domain}/.well-known/openid-configuration`. The domain, Client ID, and Client Secret are collected in a single form step and validated together — the discovery URL fetch confirms the domain is valid.

### Credential handling

The `validateDomainCredentials` action dispatches both `METADATA_VALIDATED` and `CREDENTIALS_PROVIDED` on success, since both the OIDC config and credentials are captured in the same step.

Form values (`clientId`, `clientSecret`) are saved to `state.formValues` and referenced in the `createIdp` action body.

## Wizard-v1 reference

- SAML: `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/Auth0/SAML/`
- OIDC: `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/Auth0/OIDC/`
- v1 had shared step components in `Auth0/shared/Steps/`
