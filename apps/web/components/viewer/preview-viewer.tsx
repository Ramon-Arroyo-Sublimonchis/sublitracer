"use client";

import { outlineMargin, toOutlineSvg, type VectorDocument } from "@sublitracer/vector-export";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Size, Transform } from "@/lib/viewport";

import { type PreviewMode, PreviewToolbar } from "./preview-toolbar";
import { usePanZoom } from "./use-pan-zoom";

interface PreviewViewerProps {
  originalUrl: string;
  /** Presente cuando terminó el trazado. */
  vector?: { url: string; doc: VectorDocument; outline?: VectorDocument | null };
  tracing: boolean;
  onCancel: () => void;
}

/** A partir de este zoom el original se ve pixelado, para notar la diferencia con el vector. */
const PIXELATED_FROM = 2;

export function PreviewViewer({ originalUrl, vector, tracing, onCancel }: PreviewViewerProps) {
  const [mode, setMode] = useState<PreviewMode>("compare");
  const [imageSize, setImageSize] = useState<Size | null>(null);
  // Contornos: el del motor (cada frontera una vez); en modo clásico, el de las formas.
  const outlineDoc = mode === "outlines" ? (vector?.outline ?? vector?.doc) : undefined;
  const outlineUrl = useOutlineUrl(outlineDoc);
  const view = usePanZoom(imageSize);
  const { transform } = view;

  // El tamaño natural del original define el sistema de coordenadas (el vector tiene la misma proporción).
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = originalUrl;
    return () => {
      cancelled = true;
    };
  }, [originalUrl]);

  const activeMode = vector ? mode : "compare";
  const compare = activeMode === "compare";
  const mainUrl = activeMode === "outlines" ? outlineUrl : vector?.url;

  return (
    <section
      aria-label="Previsualización"
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <PreviewToolbar
        mode={activeMode}
        onModeChange={setMode}
        hasVector={Boolean(vector)}
        zoom={transform.zoom}
        canZoomIn={view.canZoomIn}
        canZoomOut={view.canZoomOut}
        onZoomIn={view.zoomIn}
        onZoomOut={view.zoomOut}
        onFit={view.fit}
        onActualSize={view.actualSize}
      />

      <section
        {...view.surfaceProps}
        aria-roledescription="lienzo"
        aria-label="Lienzo: Ctrl + rueda para acercar, arrastra para mover, doble clic para ampliar"
        className={cn(
          "grid h-[65vh] min-h-90 touch-none gap-px bg-border outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset",
          compare ? "grid-rows-2 md:grid-cols-2 md:grid-rows-1" : "grid-cols-1",
          view.dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {compare && (
          <Pane label="Original">
            {imageSize && (
              <Layer
                src={originalUrl}
                size={imageSize}
                transform={transform}
                pixelated={transform.zoom >= PIXELATED_FROM}
              />
            )}
          </Pane>
        )}
        <Pane
          paneRef={view.paneRef}
          label={compare ? "Vector" : undefined}
          light={activeMode === "outlines"}
        >
          {imageSize && mainUrl && !tracing && (
            <Layer
              src={mainUrl}
              size={imageSize}
              transform={transform}
              margin={activeMode === "outlines" && outlineDoc ? outlineMargin(outlineDoc) : 0}
            />
          )}
          {tracing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 text-muted-foreground backdrop-blur-[2px]">
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
              <span aria-live="polite">Trazando curvas…</span>
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X /> Cancelar
              </Button>
            </div>
          )}
        </Pane>
      </section>
    </section>
  );
}

function Pane({
  label,
  light,
  paneRef,
  children,
}: {
  label?: string;
  light?: boolean;
  paneRef?: (el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-pane
      ref={paneRef}
      className={cn("relative min-h-0 overflow-hidden", light ? "bg-white" : "checkerboard")}
    >
      {children}
      {label && (
        <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-background/85 px-2 py-0.5 text-xs font-medium shadow-xs backdrop-blur">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Capa de imagen. El zoom cambia el ancho y alto reales (no `scale`), así el navegador
 * vuelve a dibujar el SVG a la resolución final y se mantiene nítido. `margin` es lo que el
 * SVG mide de más por cada lado, en píxeles de la imagen: no altera su posición ni su escala.
 */
function Layer({
  src,
  size,
  transform,
  pixelated = false,
  margin = 0,
}: {
  src: string;
  size: Size;
  transform: Transform;
  pixelated?: boolean;
  margin?: number;
}) {
  const offset = margin * transform.zoom;
  return (
    // biome-ignore lint/performance/noImgElement: blob local; next/image no aplica
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute top-0 left-0 max-w-none"
      style={{
        width: size.width * transform.zoom + 2 * offset,
        height: size.height * transform.zoom + 2 * offset,
        transform: `translate(${transform.x - offset}px, ${transform.y - offset}px)`,
        imageRendering: pixelated ? "pixelated" : "auto",
      }}
    />
  );
}

/** URL blob de la vista de contornos; se crea solo cuando se usa y se libera al salir. */
function useOutlineUrl(doc: VectorDocument | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!doc) return;
    const next = URL.createObjectURL(new Blob([toOutlineSvg(doc)], { type: "image/svg+xml" }));
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(undefined);
    };
  }, [doc]);
  return url;
}
