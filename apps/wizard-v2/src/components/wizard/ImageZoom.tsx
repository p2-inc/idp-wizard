import { useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageZoomProps {
  src: string;
  alt?: string;
  caption?: string;
  className?: string;
  fullWidth?: boolean;
}

export function ImageZoom({
  src,
  alt = "",
  caption,
  className,
  fullWidth = false,
}: ImageZoomProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <figure
        className={cn(
          "w-full",
          fullWidth ? null : "max-w-[760px]",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block w-full overflow-hidden rounded-lg border border-border"
          aria-label="Click to zoom"
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-3 w-3" />
            Zoom
          </span>
        </button>
        {caption && (
          <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">
            {caption}
          </figcaption>
        )}
      </figure>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
          {caption && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-sm text-white">
              {caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
