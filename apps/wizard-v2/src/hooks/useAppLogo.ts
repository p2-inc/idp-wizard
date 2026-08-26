import { useTheme } from "@/components/theme-provider";
import { useWizardConfig } from "@/hooks/useWizardConfig";

/**
 * Resolves the wizard's branding logo with cascading precedence:
 *   1. Theme-specific tenant override (logoUrlLight / logoUrlDark)
 *   2. Tenant single logo (logoUrl)
 *   3. Themed Phase Two fallback
 */
export function useAppLogo() {
  const { resolvedTheme } = useTheme();
  const { config } = useWizardConfig();
  const themed =
    resolvedTheme === "dark" ? config.logoUrlDark : config.logoUrlLight;
  const fallback = `/phasetwo-logos/${resolvedTheme}/logo_phase_slash.svg`;
  return {
    src: themed ?? config.logoUrl ?? fallback,
    fallback,
  };
}
