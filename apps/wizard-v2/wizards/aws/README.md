# AWS SSO SAML

## Deviations from generic SAML

### syncMode: IMPORT

AWS SSO uses `syncMode: "IMPORT"` instead of the standard `"FORCE"`. This means user attributes are only written to Keycloak on first login, not overwritten on every login.

This applies to both:
- `idpConfig.defaults.syncMode` — on the IDP config itself
- `addSamlMappers` foreach body `config.syncMode` — on each attribute mapper

### Why IMPORT?

AWS SSO is typically used as a directory source where users may also be managed in Keycloak after initial provisioning. FORCE would overwrite any local changes on every login.

## Wizard-v1 reference

- `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/AWS/saml/`
- v1 had 6 steps (extra instruction steps for AWS console navigation)
- v1 applied the syncMode override inline in the confirmation step's validate function
