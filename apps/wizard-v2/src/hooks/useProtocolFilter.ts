import { useCallback } from "react";
import type { Protocol, Provider } from "@/data/providers";
import { useWizardConfig, type WizardConfig } from "@/hooks/useWizardConfig";

/**
 * Whether a protocol is allowed by the realm's wizard config.
 *
 * `ldap` is gated by `_providerConfig.wizard.enableLdap`. Every other protocol is
 * always enabled.
 */
export function isProtocolEnabled(
  protocol: Protocol,
  config: Pick<WizardConfig, "enableLdap">,
): boolean {
  if (protocol === "ldap") return config.enableLdap;
  return true;
}

/**
 * Returns `provider` with disabled protocols removed, or `null` when none remain
 * (e.g. the generic LDAP provider while LDAP is disabled).
 */
export function filterProviderProtocols(
  provider: Provider,
  config: Pick<WizardConfig, "enableLdap">,
): Provider | null {
  const protocols = provider.protocols.filter((p) =>
    isProtocolEnabled(p, config),
  );
  if (protocols.length === 0) return null;
  if (protocols.length === provider.protocols.length) return provider;
  return { ...provider, protocols };
}

/**
 * Feature-flag-aware protocol filtering for the provider grid, protocol picker and
 * wizard route.
 *
 * Gated protocols count as disabled while the config is still loading, so a realm
 * that turned a protocol off never sees it flash on screen first.
 */
export function useProtocolFilter() {
  const { config, loading } = useWizardConfig();
  const enableLdap = !loading && config.enableLdap;

  const isEnabled = useCallback(
    (protocol: Protocol) => isProtocolEnabled(protocol, { enableLdap }),
    [enableLdap],
  );

  const filterProviders = useCallback(
    (list: Provider[]): Provider[] =>
      list.flatMap((p) => filterProviderProtocols(p, { enableLdap }) ?? []),
    [enableLdap],
  );

  return { isEnabled, filterProviders, loading };
}
