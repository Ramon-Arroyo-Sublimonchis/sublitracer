"use client";

import { Maximize, Mouse, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PreviewMode = "compare" | "vector" | "outlines";

const MODES: { id: PreviewMode; label: string; title: string }[] = [
  { id: "compare", label: "Comparar", title: "Original y vector lado a lado" },
  { id: "vector", label: "Vector", title: "Solo el resultado vectorial" },
  { id: "outlines", label: "Contornos", title: "Solo las líneas de cada forma" },
];

interface PreviewToolbarProps {
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  /** Mientras no hay vector, solo se puede ver el original. */
  hasVector: boolean;
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onActualSize: () => void;
}

export function PreviewToolbar(props: PreviewToolbarProps) {
  const { mode, hasVector } = props;

  return (
    <div
      role="toolbar"
      aria-label="Previsualización"
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-b bg-card px-3 py-3"
    >
      <div className="flex gap-2">
        {MODES.map(({ id, label, title }) => {
          const active = id === mode;
          return (
            <button
              key={id}
              type="button"
              title={title}
              aria-pressed={active}
              disabled={!hasVector && id !== "compare"}
              onClick={() => props.onModeChange(id)}
              className={cn(
                "h-10 rounded-lg border bg-background px-3 text-sm font-medium transition-colors sm:h-11 sm:px-5 sm:text-base",
                "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                active
                  ? "border-primary bg-accent text-primary ring-2 ring-primary/25"
                  : "hover:border-primary/40 hover:bg-accent/40",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <IconButton title="Alejar (−)" onClick={props.onZoomOut} disabled={!props.canZoomOut}>
          <ZoomOut />
        </IconButton>
        <IconButton title="Acercar (+)" onClick={props.onZoomIn} disabled={!props.canZoomIn}>
          <ZoomIn />
        </IconButton>
        <IconButton title="Ajustar a la vista (0)" onClick={props.onFit}>
          <Maximize />
        </IconButton>
        <IconButton title="Tamaño real 1:1 (1)" onClick={props.onActualSize}>
          <span className="rounded-[3px] border-[1.5px] border-current px-0.5 text-xs leading-4 font-semibold">
            1:1
          </span>
        </IconButton>
        <span className="hidden w-14 text-right text-sm tabular-nums text-muted-foreground sm:inline">
          {Math.round(props.zoom * 100)} %
        </span>
      </div>

      <p className="hidden items-center gap-2 text-base font-medium text-primary md:flex">
        <kbd className="flex h-9 items-center rounded-lg border border-primary bg-accent px-3 font-sans ring-2 ring-primary/25">
          Ctrl
        </kbd>
        +
        <Mouse className="size-6" aria-hidden />
        Rueda: zoom
      </p>
    </div>
  );
}

function IconButton({
  title,
  children,
  ...props
}: { title: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      aria-label={title}
      className="size-10 text-primary hover:text-primary sm:size-11 [&_svg:not([class*='size-'])]:size-6"
      {...props}
    >
      {children}
    </Button>
  );
}
