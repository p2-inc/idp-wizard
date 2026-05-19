import { useTheme } from "@/components/theme-provider";

export function useProviderLogo(filename: string) {
  const { resolvedTheme } = useTheme();
  return `/provider-logos/${resolvedTheme}/${filename}`;
}
