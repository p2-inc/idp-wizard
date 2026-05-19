import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const order: Theme[] = ["light", "dark", "system"];
const labels: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const next = order[(order.indexOf(theme) + 1) % order.length];
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${labels[next]} theme`}
      title={`Theme: ${labels[theme]} (click for ${labels[next]})`}
      className={cn(
        "border-border bg-card text-foreground hover:bg-accent inline-flex h-9 w-9 items-center justify-center rounded-md border shadow-sm transition-colors",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
