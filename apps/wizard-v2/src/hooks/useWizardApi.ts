import { useMemo } from "react";
import { useWizardConfig } from "./useWizardConfig";
import { createOrgsClient, createAdminClient, type OrgsClient, type AdminClient } from "@/api/clients";
import type { WizardContextValue } from "@/context/WizardContext";

/**
 * Parses a Keycloak issuer URI into its server base URL and realm name.
 * Handles both the legacy /auth prefix and the modern path style.
 *
 * Examples:
 *   http://localhost:8080/realms/myrealm       → { serverUrl: "http://localhost:8080", realm: "myrealm" }
 *   http://localhost:8080/auth/realms/myrealm  → { serverUrl: "http://localhost:8080/auth", realm: "myrealm" }
 */
function parseIssuerUri(issuerUri: string): { serverUrl: string; realm: string } {
  const match = issuerUri.match(/^(https?:\/\/.+?)\/realms\/([^/]+)\/?$/);
  if (match) return { serverUrl: match[1], realm: match[2] };
  return { serverUrl: issuerUri, realm: "" };
}

export interface WizardApiContext extends Omit<WizardContextValue, "state" | "dispatch"> {
  /** Typed client for Phase Two Orgs API — used in cloud (org-scoped) mode */
  orgsClient: OrgsClient;
  /** Typed client for Keycloak Admin API — used in onprem (realm-wide) mode */
  adminClient: AdminClient;
  /** Convenience: the active client for the current apiMode */
  activeClient: OrgsClient | AdminClient;
}

/**
 * Builds the full wizard API context from:
 * - VITE_OIDC_ISSUER_URI env var → serverUrl + realm
 * - orgId from the URL search param → cloud vs onprem mode
 * - WizardConfig feature flags → may override apiMode
 */
export function useWizardApi(orgId: string | null): WizardApiContext {
  const { config } = useWizardConfig();

  return useMemo(() => {
    const issuerUri = (import.meta.env.VITE_OIDC_ISSUER_URI as string) ?? "";
    const { serverUrl, realm } = parseIssuerUri(issuerUri);

    // org_id in the URL always means cloud mode; otherwise use the realm config value
    const apiMode: "cloud" | "onprem" = orgId
      ? "cloud"
      : config.apiMode === "cloud"
        ? "cloud"
        : "onprem";

    const adminBase = `${serverUrl}/admin`;

    // Template values exposed to wizard JSON blocks via {{api.*}}
    const api = {
      entityId: `${serverUrl}/realms/${realm}`,
      ssoUrl: (alias: string) => `${serverUrl}/realms/${realm}/broker/${alias}/endpoint`,
      samlMetadata: `${serverUrl}/realms/${realm}/protocol/saml/descriptor`,
      adminLinkSaml: (alias: string) =>
        `${adminBase}/${realm}/console/#/identity-providers/saml/${alias}/settings`,
      adminLinkOidc: (alias: string) =>
        `${adminBase}/${realm}/console/#/identity-providers/oidc/${alias}/settings`,
      /**
       * Legacy URL-based endpoints kept for the wizard JSON action runner
       * until the runner is built to call typed client methods directly.
       */
      endpoints:
        apiMode === "cloud" && orgId
          ? {
              importConfig: `${serverUrl}/realms/${realm}/orgs/${orgId}/idps/import-config`,
              createIdp: `${serverUrl}/realms/${realm}/orgs/${orgId}/idps`,
              addMappers: (alias: string) =>
                `${serverUrl}/realms/${realm}/orgs/${orgId}/idps/${alias}/mappers`,
            }
          : {
              importConfig: `${adminBase}/realms/${realm}/identity-provider/import-config`,
              createIdp: `${adminBase}/realms/${realm}/identity-provider/instances`,
              addMappers: (alias: string) =>
                `${adminBase}/realms/${realm}/identity-provider/instances/${alias}/mappers`,
            },
    };

    const orgsClient = createOrgsClient(serverUrl);
    const adminClient = createAdminClient(serverUrl);
    const activeClient = apiMode === "cloud" ? orgsClient : adminClient;

    return { orgId, apiMode, realm, serverUrl, api, orgsClient, adminClient, activeClient };
  }, [orgId, config.apiMode]);
}
