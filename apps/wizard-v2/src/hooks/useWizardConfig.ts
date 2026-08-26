import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/oidc";
import { getRuntimeConfig } from "@/runtime-config";

export interface WizardConfig {
  appName: string | null;
  logoUrl: string | null;
  logoUrlLight: string | null;
  logoUrlDark: string | null;
  displayName: string;
  // spell-checker: disable-next-line
  apiMode: "cloud" | "onprem" | "";
  emailAsUsername: boolean;
  usernameMapperImport: boolean;
  enableDashboard: boolean;
  enableLdap: boolean;
  enableGroupMapping: boolean;
  trustEmail: boolean;
}

const DEFAULT_CONFIG: WizardConfig = {
  appName: null,
  logoUrl: null,
  logoUrlLight: null,
  logoUrlDark: null,
  displayName: "Identity Provider",
  apiMode: "",
  emailAsUsername: false,
  usernameMapperImport: true,
  enableDashboard: false,
  enableLdap: false,
  enableGroupMapping: false,
  trustEmail: false,
};

/**
 * The SPI serves config.json for the realm being configured. This must use the target
 * realm, not the auth realm — with `_providerConfig.wizard.auth-realm-override` set the
 * two differ, and the auth realm's config.json describes the wrong realm.
 */
function getConfigUrl(): string | null {
  const { serverUrl, targetRealm } = getRuntimeConfig();
  if (!serverUrl || !targetRealm) return null;
  return `${serverUrl}/realms/${targetRealm}/wizard/config.json`;
}

export function useWizardConfig() {
  const [config, setConfig] = useState<WizardConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = getConfigUrl();

    const request = url
      ? fetchWithAuth(url)
          .then((res) => {
            if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
            return res.json() as Promise<Partial<WizardConfig>>;
          })
          .then((data) => setConfig({ ...DEFAULT_CONFIG, ...data }))
          .catch(() => {
            // Silently fall back to defaults — config endpoint may not exist in dev
          })
      : Promise.resolve();

    request.finally(() => setLoading(false));
  }, []);

  return { config, loading };
}
