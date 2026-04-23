export type Protocol = "saml" | "oidc" | "ldap";

export interface Provider {
  id: string;
  name: string;
  logo: string;
  protocols: Protocol[];
}

export const genericProviders: Provider[] = [
  {
    id: "saml",
    name: "Generic SAML",
    logo: "/provider-logos/saml_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "openid",
    name: "Generic OpenID",
    logo: "/provider-logos/openid_logo.png",
    protocols: ["oidc"],
  },
  {
    id: "ldap",
    name: "Generic LDAP",
    logo: "/provider-logos/ldap_logo.svg",
    protocols: ["ldap"],
  },
];

export const providers: Provider[] = [
  {
    id: "adfs",
    name: "ADFS",
    logo: "/provider-logos/active-directory.svg",
    protocols: ["saml"],
  },
  {
    id: "auth0",
    name: "Auth0",
    logo: "/provider-logos/auth0_logo.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "aws",
    name: "AWS",
    logo: "/wizards/aws/aws-logo.svg",
    protocols: ["saml"],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    logo: "/wizards/cloudflare/cloudflare.svg",
    protocols: ["saml"],
  },
  {
    id: "cyberark",
    name: "CyberArk",
    logo: "/provider-logos/cyberark_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "duo",
    name: "Duo",
    logo: "/wizards/duo/duo.svg",
    protocols: ["saml"],
  },
  {
    id: "google",
    name: "Google Workspace",
    logo: "/provider-logos/google-workspace-logo.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "jumpcloud",
    name: "JumpCloud",
    logo: "/wizards/jumpcloud/jumpcloud-logo.svg",
    protocols: ["saml"],
  },
  {
    id: "lastpass",
    name: "LastPass",
    logo: "/wizards/lastpass/lastpass-logo.svg",
    protocols: ["saml"],
  },
  {
    id: "entraid",
    name: "Microsoft Entra ID",
    logo: "/provider-logos/msft_entraid.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "okta",
    name: "Okta",
    logo: "/provider-logos/okta_logo.svg",
    protocols: ["saml", "oidc", "ldap"],
  },
  {
    id: "onelogin",
    name: "OneLogin",
    logo: "/wizards/onelogin/onelogin-logo.svg",
    protocols: ["saml"],
  },
  {
    id: "oracle",
    name: "Oracle",
    logo: "/provider-logos/oracle_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "pingone",
    name: "PingOne",
    logo: "/wizards/pingone/pingone-logo.svg",
    protocols: ["saml"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    logo: "/provider-logos/salesforce_logo.svg",
    protocols: ["saml", "oidc"],
  },
  {
    id: "adp",
    name: "ADP",
    logo: "/provider-logos/adp_logo.svg",
    protocols: ["oidc"],
  },
  {
    id: "cas",
    name: "CAS",
    logo: "/provider-logos/apereo_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "clever",
    name: "Clever",
    logo: "/provider-logos/clever_logo.svg",
    protocols: ["oidc"],
  },
  {
    id: "classlink",
    name: "ClassLink",
    logo: "/provider-logos/classlink_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "logingov",
    name: "Login.gov",
    logo: "/provider-logos/logingov_logo.svg",
    protocols: ["oidc"],
  },
  {
    id: "keycloak",
    name: "Keycloak",
    logo: "/provider-logos/keycloak_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "miniorange",
    name: "miniOrange",
    logo: "/provider-logos/miniorange_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "netiq",
    name: "NetIQ",
    logo: "/provider-logos/saml_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "pingfederate",
    name: "PingFederate",
    logo: "/provider-logos/ping_identity_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "rippling",
    name: "Rippling",
    logo: "/provider-logos/rippling_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "shibboleth",
    name: "Shibboleth",
    logo: "/provider-logos/shibboleth_logo.png",
    protocols: ["saml"],
  },
  {
    id: "simplesamlphp",
    name: "SimpleSAMLphp",
    logo: "/provider-logos/simplesamlphp_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "vmware",
    name: "VMware Workspace ONE",
    logo: "/provider-logos/vmware_logo.svg",
    protocols: ["saml"],
  },
];

export const allProviders = [...genericProviders, ...providers];
