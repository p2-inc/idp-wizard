import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/oidc";

export interface WizardConfig {
  appName: string | null;
  logoUrl: string | null;
  displayName: string;
  // spell-checker: disable-next-line
  apiMode: "cloud" | "onprem" | "";
  emailAsUsername: boolean;
  enableDashboard: boolean;
  enableLdap: boolean;
  enableGroupMapping: boolean;
  trustEmail: boolean;
}

const DEFAULT_CONFIG: WizardConfig = {
  appName: null,
  logoUrl: null,
  displayName: "Identity Provider",
  apiMode: "",
  emailAsUsername: false,
  enableDashboard: false,
  enableLdap: false,
  enableGroupMapping: false,
  trustEmail: false,
};

function getConfigUrl(): string | null {
  const issuerUri = import.meta.env.VITE_OIDC_ISSUER_URI as string | undefined;
  if (!issuerUri) return null;
  return `${issuerUri}/wizard/config.json`;
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
