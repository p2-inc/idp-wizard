# Okta

## SAML

### Mapper attributes

Okta uses `id` (not `username` or `uid`) as the username attribute:

| Keycloak field | Okta attribute | Notes |
|---------------|----------------|-------|
| username | `id` | Okta's internal user ID field |
| email | `email` | Standard |
| firstName | `firstName` | Standard |
| lastName | `lastName` | Standard |

### Metadata input

Okta provides SAML metadata as a downloadable XML file from the Sign On tab of the SAML application. The wizard uses file upload.

## LDAP

### Auto-fill limitation

Wizard-v1 had client-side logic that auto-populated DN fields when the host matched `*.ldap.okta.com`:
- Extracted the customer org ID from the first segment of the hostname
- Auto-filled `baseDn` as `dc={orgId},dc=okta,dc=com`
- Auto-filled `userBaseDn` as `ou=users,dc={orgId},dc=okta,dc=com`
- Auto-filled `groupBaseDn` as `ou=groups,dc={orgId},dc=okta,dc=com`

This client-side logic cannot be expressed in the JSON wizard definition. Instead, the form fields use Okta-specific placeholder text to guide the user. If this becomes a usability issue, a custom block type or form renderer enhancement could be added to support pattern-based auto-fill.

### Bind DN format

Okta LDAP uses `uid=<username>,<baseDn>` for the bind DN, which is different from the standard format. The placeholder reflects this.

### Simplified steps

Wizard-v1 had a separate group mapping step. This was removed in v2 since group federation is rarely needed in the initial LDAP setup and can be configured later in the Keycloak admin console.

### LDAP schema defaults

Okta LDAP uses fixed schema values (not configurable in the wizard):
- `vendor: "other"`
- `usernameLDAPAttribute: "uid"`
- `rdnLDAPAttribute: "uid"`
- `uuidLDAPAttribute: "entryUUID"`
- `userObjectClasses: "inetOrgPerson, organizationalPerson"`

## Wizard-v1 reference

- SAML: `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/Okta/SAML/`
- LDAP: `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/Okta/LDAP/`
- LDAP auto-fill: `Okta/LDAP/Steps/forms/server-configuration.tsx`
