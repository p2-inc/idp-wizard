export type Protocol = "saml" | "oidc" | "ldap" | "oauth" | "scim";

export interface Provider {
  id: string;
  name: string;
  logo: string;
  protocols: Protocol[];
}

export const genericProviders: Provider[] = [
  {
    id: "saml",
    name: "SAML",
    logo: "saml.svg",
    protocols: ["saml"],
  },
  {
    id: "openid",
    name: "OpenID",
    logo: "generic-oidc.svg",
    protocols: ["oidc"],
  },
  {
    id: "ldap",
    name: "LDAP",
    logo: "ldap.svg",
    protocols: ["ldap"],
  },
  {
    id: "scim",
    name: "SCIM",
    logo: "ldap.svg",
    protocols: ["scim"],
  },
];

export const popularProviders: Provider[] = [
  {
    id: "entraid",
    name: "Entra ID (Azure AD)",
    logo: "azure.svg",
    protocols: ["saml", "oidc", "scim"],
  },
  {
    id: "okta",
    name: "Okta",
    logo: "okta.svg",
    protocols: ["saml", "oidc", "ldap", "scim"],
  },
  {
    id: "google",
    name: "Google Workspace",
    logo: "google-cloud.svg",
    protocols: ["saml", "oidc", "oauth"],
  },
  {
    id: "auth0",
    name: "Auth0",
    logo: "auth0.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "adfs",
    name: "ADFS",
    logo: "active-directory.svg",
    protocols: ["saml"],
  },
  {
    id: "github",
    name: "GitHub",
    logo: "github.svg",
    protocols: ["oauth"],
  },
];

export const providers: Provider[] = [
  {
    id: "adp",
    name: "ADP",
    logo: "adp.svg",
    protocols: ["oidc"],
  },
  {
    id: "apple",
    name: "Apple",
    logo: "apple.svg",
    protocols: ["oauth"],
  },
  {
    id: "aws",
    name: "AWS",
    logo: "aws.svg",
    protocols: ["saml"],
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    logo: "bitbucket.svg",
    protocols: ["oauth"],
  },
  {
    id: "cas",
    name: "CAS",
    logo: "cas.svg",
    protocols: ["saml"],
  },
  {
    id: "classlink",
    name: "ClassLink",
    logo: "classlink.svg",
    protocols: ["saml"],
  },
  {
    id: "clever",
    name: "Clever",
    logo: "clever.svg",
    protocols: ["oidc"],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    logo: "cloudflare.svg",
    protocols: ["saml"],
  },
  {
    id: "cyberark",
    name: "CyberArk",
    logo: "cyberark.svg",
    protocols: ["saml"],
  },
  {
    id: "discord",
    name: "Discord",
    logo: "discord.svg",
    protocols: ["oauth"],
  },
  {
    id: "duo",
    name: "Duo",
    logo: "duo.svg",
    protocols: ["saml"],
  },
  {
    id: "gitlab",
    name: "GitLab",
    logo: "gitlab.svg",
    protocols: ["oauth"],
  },
  {
    id: "intuit",
    name: "Intuit",
    logo: "intuit.svg",
    protocols: ["oauth"],
  },
  {
    id: "jumpcloud",
    name: "JumpCloud",
    logo: "jumpcloud.svg",
    protocols: ["saml"],
  },
  {
    id: "keycloak",
    name: "Keycloak",
    logo: "keycloak.svg",
    protocols: ["saml"],
  },
  {
    id: "lastpass",
    name: "LastPass",
    logo: "lastpass.svg",
    protocols: ["saml"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    logo: "linkedin.svg",
    protocols: ["oauth"],
  },
  {
    id: "logingov",
    name: "Login.gov",
    logo: "login-gov.svg",
    protocols: ["oidc"],
  },
  {
    id: "microsoft",
    name: "Microsoft",
    logo: "microsoft.svg",
    protocols: ["oauth"],
  },
  {
    id: "miniorange",
    name: "miniOrange",
    logo: "miniorange.svg",
    protocols: ["saml"],
  },
  {
    id: "netiq",
    name: "NetIQ",
    logo: "net-iq.svg",
    protocols: ["saml"],
  },
  {
    id: "onelogin",
    name: "OneLogin",
    logo: "onelogin.svg",
    protocols: ["saml"],
  },
  {
    id: "oracle",
    name: "Oracle",
    logo: "oracle.svg",
    protocols: ["saml"],
  },
  {
    id: "pingfederate",
    name: "PingFederate",
    logo: "ping-identity.svg",
    protocols: ["saml"],
  },
  {
    id: "pingone",
    name: "PingOne",
    logo: "ping-identity.svg",
    protocols: ["saml"],
  },
  {
    id: "rippling",
    name: "Rippling",
    logo: "rippling.svg",
    protocols: ["saml"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    logo: "salesforce.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "shibboleth",
    name: "Shibboleth",
    logo: "shibboleth.svg",
    protocols: ["saml"],
  },
  {
    id: "simplesamlphp",
    name: "SimpleSAMLphp",
    logo: "simple-saml-php.svg",
    protocols: ["saml"],
  },
  {
    id: "slack",
    name: "Slack",
    logo: "slack.svg",
    protocols: ["oauth"],
  },
  {
    id: "vercel",
    name: "Vercel",
    logo: "vercel.svg",
    protocols: ["oauth"],
  },
  {
    id: "vercel-marketplace",
    name: "Vercel Marketplace",
    logo: "vercel.svg",
    protocols: ["oauth"],
  },
  {
    id: "vmware",
    name: "VMware Workspace ONE",
    logo: "vmware.svg",
    protocols: ["saml"],
  },
  {
    id: "xero",
    name: "Xero",
    logo: "xero.svg",
    protocols: ["oauth"],
  },
];

export const allProviders = [
  ...popularProviders,
  ...providers,
  ...genericProviders,
];
