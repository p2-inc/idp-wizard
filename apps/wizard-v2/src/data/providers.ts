export type Protocol = "saml" | "oidc" | "ldap" | "oauth";

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
    logo: "/provider-logos/light/saml.svg",
    protocols: ["saml"],
  },
  {
    id: "openid",
    name: "OpenID",
    logo: "/provider-logos/light/generic-oidc.svg",
    protocols: ["oidc"],
  },
  {
    id: "ldap",
    name: "LDAP",
    logo: "/provider-logos/light/ldap.svg",
    protocols: ["ldap"],
  },
];

export const popularProviders: Provider[] = [
  {
    id: "entraid",
    name: "Entra ID (Azure AD)",
    logo: "/provider-logos/light/azure.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "okta",
    name: "Okta",
    logo: "/provider-logos/light/okta.svg",
    protocols: ["saml", "oidc", "ldap"],
  },
  {
    id: "google",
    name: "Google Workspace",
    logo: "/provider-logos/light/google-cloud.svg",
    protocols: ["saml", "oidc", "oauth"],
  },
  {
    id: "auth0",
    name: "Auth0",
    logo: "/provider-logos/light/auth0.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "adfs",
    name: "ADFS",
    logo: "/provider-logos/light/active-directory.svg",
    protocols: ["saml"],
  },
  {
    id: "github",
    name: "GitHub",
    logo: "/provider-logos/light/github.svg",
    protocols: ["oauth"],
  },
];

export const providers: Provider[] = [
  {
    id: "adp",
    name: "ADP",
    logo: "/provider-logos/light/adp.svg",
    protocols: ["oidc"],
  },
  {
    id: "apple",
    name: "Apple",
    logo: "/provider-logos/light/apple.svg",
    protocols: ["oauth"],
  },
  {
    id: "aws",
    name: "AWS",
    logo: "/provider-logos/light/aws.svg",
    protocols: ["saml"],
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    logo: "/provider-logos/light/bitbucket.svg",
    protocols: ["oauth"],
  },
  {
    id: "cas",
    name: "CAS",
    logo: "/provider-logos/light/cas.svg",
    protocols: ["saml"],
  },
  {
    id: "classlink",
    name: "ClassLink",
    logo: "/provider-logos/light/classlink.svg",
    protocols: ["saml"],
  },
  {
    id: "clever",
    name: "Clever",
    logo: "/provider-logos/light/clever.svg",
    protocols: ["oidc"],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    logo: "/provider-logos/light/cloudflare.svg",
    protocols: ["saml"],
  },
  {
    id: "cyberark",
    name: "CyberArk",
    logo: "/provider-logos/light/cyberark.svg",
    protocols: ["saml"],
  },
  {
    id: "discord",
    name: "Discord",
    logo: "/provider-logos/light/discord.webp",
    protocols: ["oauth"],
  },
  {
    id: "duo",
    name: "Duo",
    logo: "/provider-logos/light/duo.svg",
    protocols: ["saml"],
  },
  {
    id: "gitlab",
    name: "GitLab",
    logo: "/provider-logos/light/gitlab.svg",
    protocols: ["oauth"],
  },
  {
    id: "intuit",
    name: "Intuit",
    logo: "/provider-logos/light/intuit.svg",
    protocols: ["oauth"],
  },
  {
    id: "jumpcloud",
    name: "JumpCloud",
    logo: "/provider-logos/light/jumpcloud.svg",
    protocols: ["saml"],
  },
  {
    id: "keycloak",
    name: "Keycloak",
    logo: "/provider-logos/light/keycloak.svg",
    protocols: ["saml"],
  },
  {
    id: "lastpass",
    name: "LastPass",
    logo: "/provider-logos/light/lastpass.svg",
    protocols: ["saml"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    logo: "/provider-logos/light/linkedin.svg",
    protocols: ["oauth"],
  },
  {
    id: "logingov",
    name: "Login.gov",
    logo: "/provider-logos/light/login-gov.svg",
    protocols: ["oidc"],
  },
  {
    id: "microsoft",
    name: "Microsoft",
    logo: "/provider-logos/light/microsoft.svg",
    protocols: ["oauth"],
  },
  {
    id: "miniorange",
    name: "miniOrange",
    logo: "/provider-logos/light/miniorange.svg",
    protocols: ["saml"],
  },
  {
    id: "netiq",
    name: "NetIQ",
    logo: "/provider-logos/light/net-iq.svg",
    protocols: ["saml"],
  },
  {
    id: "onelogin",
    name: "OneLogin",
    logo: "/provider-logos/light/onelogin.svg",
    protocols: ["saml"],
  },
  {
    id: "oracle",
    name: "Oracle",
    logo: "/provider-logos/light/oracle.svg",
    protocols: ["saml"],
  },
  {
    id: "pingfederate",
    name: "PingFederate",
    logo: "/provider-logos/light/ping-identity.svg",
    protocols: ["saml"],
  },
  {
    id: "pingone",
    name: "PingOne",
    logo: "/provider-logos/light/ping-identity.svg",
    protocols: ["saml"],
  },
  {
    id: "rippling",
    name: "Rippling",
    logo: "/provider-logos/light/rippling.svg",
    protocols: ["saml"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    logo: "/provider-logos/light/salesforce.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "shibboleth",
    name: "Shibboleth",
    logo: "/provider-logos/light/shibboleth.svg",
    protocols: ["saml"],
  },
  {
    id: "simplesamlphp",
    name: "SimpleSAMLphp",
    logo: "/provider-logos/light/simple-saml-php.svg",
    protocols: ["saml"],
  },
  {
    id: "slack",
    name: "Slack",
    logo: "/provider-logos/light/slack.svg",
    protocols: ["oauth"],
  },
  {
    id: "vercel",
    name: "Vercel",
    logo: "/provider-logos/light/vercel.svg",
    protocols: ["oauth"],
  },
  {
    id: "vercel-marketplace",
    name: "Vercel Marketplace",
    logo: "/provider-logos/light/vercel.svg",
    protocols: ["oauth"],
  },
  {
    id: "vmware",
    name: "VMware Workspace ONE",
    logo: "/provider-logos/light/vmware.svg",
    protocols: ["saml"],
  },
  {
    id: "xero",
    name: "Xero",
    logo: "/provider-logos/light/xero.svg",
    protocols: ["oauth"],
  },
];

export const allProviders = [
  ...popularProviders,
  ...providers,
  ...genericProviders,
];
