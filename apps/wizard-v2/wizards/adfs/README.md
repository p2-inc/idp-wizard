# ADFS SAML

## Deviations from generic SAML

### Config overrides

ADFS requires several non-default SAML settings:

| Setting | Value | Why |
|---------|-------|-----|
| `nameIDPolicyFormat` | `urn:oasis:names:tc:SAML:2.0:nameid-format:persistent` | ADFS defaults to persistent NameID; the generic wizard uses `unspecified` |
| `wantAuthnRequestsSigned` | `true` | ADFS rejects unsigned authn requests by default |
| `signatureAlgorithm` | `RSA_SHA256` | ADFS requires SHA-256; Keycloak's default may differ |
| `xmlSigKeyInfoKeyNameTransformer` | `CERT_SUBJECT` | Required for ADFS to locate the signing certificate |

These are set in `idpConfig.defaults` and merged into the IDP config at creation time.

### Mapper attributes

ADFS sends attributes as Microsoft claim URIs, not simple names:

| Keycloak field | ADFS claim URI |
|---------------|----------------|
| username | `http://schemas.microsoft.com/2012/12/certificatecontext/field/subjectname` |
| email | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| firstName | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname` |
| lastName | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname` |

The user must configure these as Claims Rules in the ADFS Relying Party Trust.

### Metadata URL format

ADFS metadata is always at a predictable URL: `https://<hostname>/federationmetadata/2007-06/federationmetadata.xml`

The placeholder in the form reflects this pattern.

## Wizard-v1 reference

- `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/ADFS/saml/`
- v1 had 5 steps with provider-specific instruction screenshots
- v1 also did a PUT to `updateIdPUrl` after creation to apply config overrides — in v2, the overrides are baked into the creation payload via `idpConfig.defaults`
