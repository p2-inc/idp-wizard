import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyFieldProps {
  label?: string;
  value: string;
  hint?: string;
  className?: string;
}

export function CopyField({ label, value, hint, className }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-sm font-medium">{label}</span>
      )}
      <div className="border-border bg-muted/40 flex items-center gap-2 rounded-md border px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs">{value || "—"}</code>
        <button
          onClick={handleCopy}
          disabled={!value}
          className={cn(
            "shrink-0 rounded p-1 transition-colors",
            copied
              ? "text-green-600 dark:text-green-400"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
