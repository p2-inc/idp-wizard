import { useTheme } from "@/components/theme-provider";
import { assetUrl } from "@/runtime-config";

export function useProviderLogo(filename: string) {
  const { resolvedTheme } = useTheme();
  return assetUrl(`/provider-logos/${resolvedTheme}/${filename}`);
}
