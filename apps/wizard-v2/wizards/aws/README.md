# AWS SSO SAML

## Deviations from generic SAML

### syncMode: IMPORT

AWS SSO uses `syncMode: "IMPORT"` instead of the standard `"FORCE"`. This means user attributes are only written to Keycloak on first login, not overwritten on every login.

This applies to both:
- `idpConfig.defaults.syncMode` — on the IDP config itself
- `addSamlMappers` foreach body `config.syncMode` — on each attribute mapper

### Why IMPORT?

AWS SSO is typically used as a directory source where users may also be managed in Keycloak after initial provisioning. FORCE would overwrite any local changes on every login.

## Capture scripts

The `playwright/` folder contains scripts that walk through the AWS console and
take screenshots at each wizard step. Use these to refresh the wizard's images
after AWS updates their UI.

Scripts are registered as `pnpm` commands from `apps/wizard-v2/`:

| Command | Script | Purpose |
|---|---|---|
| `pnpm capture:aws:saml` | `playwright/saml-capture.ts` | SAML setup via IAM Identity Center |

When adding a new script (e.g. `oidc-capture.ts`), add a corresponding
`capture:aws:oidc` entry to `apps/wizard-v2/package.json` and a row to the
table above.

Screenshots land in `playwright/screenshots/` and should be copied to
`public/wizards/aws/` once reviewed.

The login step always pauses for manual input — IAM Identity Center uses SSO/MFA
that cannot be automated. All other steps run unattended.

## Wizard-v1 reference

- `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/AWS/saml/`
- v1 had 6 steps (extra instruction steps for AWS console navigation)
- v1 applied the syncMode override inline in the confirmation step's validate function
