# Salesforce

## SAML

Standard SAML URL metadata flow. No deviations from the generic pattern.

Wizard-v1 had extra instruction steps for enabling the Identity Provider and creating a Connected App — these are captured as step instruction text in v2.

## OIDC

### Domain-based discovery

Same pattern as Auth0 OIDC: the Salesforce instance domain is used to construct the discovery URL `https://{domain}/.well-known/openid-configuration`.

### Field labels

Salesforce uses "Consumer Key" and "Consumer Secret" instead of "Client ID" and "Client Secret". The form labels reflect Salesforce terminology.

### Shared steps

Wizard-v1 had a shared `SalesforceStepConnectedApp` component used by both the SAML and OIDC wizards. In v2, the Connected App instructions are duplicated as step text in each JSON file since they're short and the JSON format doesn't support cross-file sharing.

## Wizard-v1 reference

- SAML: `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/Salesforce/SAML/`
- OIDC: `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/Salesforce/OIDC/`
- Shared: `apps/wizard-v1/src/app/components/IdentityProviderWizard/Wizards/Providers/Salesforce/shared/`
