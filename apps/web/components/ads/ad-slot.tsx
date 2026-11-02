"use client";

import { useEffect, useRef } from "react";

import { AD_CLIENT } from "@/lib/site";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdFormat = "auto" | "horizontal" | "in-article";

/** Altura reservada por formato: el anuncio no empuja el contenido al cargar (CLS ≈ 0). */
const MIN_HEIGHT: Record<AdFormat, number> = {
  auto: 280,
  horizontal: 90,
  "in-article": 250,
};

const DATA_ATTRIBUTES: Record<AdFormat, Record<string, string>> = {
  auto: { "data-ad-format": "auto", "data-full-width-responsive": "true" },
  horizontal: { "data-ad-format": "horizontal", "data-full-width-responsive": "false" },
  "in-article": { "data-ad-format": "fluid", "data-ad-layout": "in-article" },
};

interface AdSlotProps {
  slot: string;
  format: AdFormat;
  className?: string;
}

/**
 * Bloque de AdSense con espacio reservado. En localhost no se inicializa (se ve la caja
 * vacía), y tampoco si está oculto (p. ej. el banner horizontal en pantallas chicas).
 */
export function AdSlot({ slot, format, className }: AdSlotProps) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    // Dejar que el hilo principal termine de pintar la herramienta antes del anuncio.
    const timer = setTimeout(() => {
      const ins = insRef.current;
      if (!ins || ins.offsetWidth === 0 || ins.getAttribute("data-adsbygoogle-status")) return;
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch (error) {
        console.warn("AdSense:", error);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const minHeight = MIN_HEIGHT[format];
  const inArticle = format === "in-article";

  return (
    <aside aria-label="Publicidad" className={cn("flex w-full flex-col items-center", className)}>
      <span className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Publicidad
      </span>
      {/* El formato "auto" puede ocupar todo el ancho del celular: recortarlo lo dejaría cortado. */}
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-xl border bg-card/50",
          format !== "auto" && "overflow-hidden",
        )}
        style={{ minHeight }}
      >
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{
            display: "block",
            width: "100%",
            minHeight,
            ...(inArticle ? { textAlign: "center" as const } : {}),
          }}
          data-ad-client={AD_CLIENT}
          data-ad-slot={slot}
          {...DATA_ATTRIBUTES[format]}
        />
      </div>
    </aside>
  );
}
