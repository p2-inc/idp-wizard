import { useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileInputProps {
  label?: string;
  accept?: string;
  required?: boolean;
  onChange: (file: File | null) => void;
  value?: File | null;
  className?: string;
}

export function FileInput({
  label,
  accept,
  required,
  onChange,
  value,
  className,
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File | null) => {
    onChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0] ?? null;
    handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
      )}
      <div
        onClick={() => !value && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-border flex min-h-[80px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          dragOver && "border-primary bg-primary/5",
          value ? "cursor-default border-solid bg-muted/40" : "hover:border-muted-foreground/50 hover:bg-muted/20",
        )}
      >
        {value ? (
          <div className="flex w-full items-center gap-3 px-4 py-3">
            <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {value.name}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {(value.size / 1024).toFixed(1)} KB
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 transition-colors hover:bg-muted"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <Upload className="text-muted-foreground h-6 w-6" />
            <p className="text-muted-foreground text-sm">
              Drop a file here or{" "}
              <span className="text-foreground underline underline-offset-2">
                browse
              </span>
            </p>
            {accept && (
              <p className="text-muted-foreground/70 text-xs">{accept}</p>
            )}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="sr-only"
        aria-label={label}
      />
    </div>
  );
}
