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
    logo: "/provider-logos/auth0_logo.png",
    protocols: ["saml", "oidc"],
  },
  {
    id: "aws",
    name: "AWS",
    logo: "/provider-logos/aws.jpg",
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
    protocols: ["saml"],
  },
  {
    id: "jumpcloud",
    name: "JumpCloud",
    logo: "/provider-logos/jumpcloud_logo.svg",
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
    protocols: ["saml"],
  },
  {
    id: "okta",
    name: "Okta",
    logo: "/provider-logos/okta_logo.png",
    protocols: ["saml", "ldap"],
  },
  {
    id: "onelogin",
    name: "OneLogin",
    logo: "/provider-logos/onelogin_logo.png",
    protocols: ["saml"],
  },
  {
    id: "oracle",
    name: "Oracle",
    logo: "/wizards/oracle/oracle-logo.png",
    protocols: ["saml"],
  },
  {
    id: "pingone",
    name: "PingOne",
    logo: "/provider-logos/ping_one_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    logo: "/wizards/salesforce/salesforce-logo.png",
    protocols: ["saml", "oidc"],
  },
  {
    id: "cas",
    name: "CAS",
    logo: "/provider-logos/saml_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "classlink",
    name: "ClassLink",
    logo: "/provider-logos/saml_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "keycloak",
    name: "Keycloak",
    logo: "/provider-logos/saml_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "miniorange",
    name: "miniOrange",
    logo: "/provider-logos/saml_logo.svg",
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
    logo: "/provider-logos/ping_federate_logo.png",
    protocols: ["saml"],
  },
  {
    id: "rippling",
    name: "Rippling",
    logo: "/provider-logos/saml_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "shibboleth",
    name: "Shibboleth",
    logo: "/provider-logos/saml_logo.svg",
    protocols: ["saml"],
  },
  {
    id: "simplesamlphp",
    name: "SimpleSAMLphp",
    logo: "/provider-logos/saml_logo.svg",
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
