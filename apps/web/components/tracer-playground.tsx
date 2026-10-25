"use client";

import { parseTracedSvg, type VectorDocument } from "@sublitracer/vector-export";
import { ImageUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AdSlot } from "@/components/ads/ad-slot";
import { DownloadPanel } from "@/components/export/download-panel";
import { PreviewViewer } from "@/components/viewer/preview-viewer";
import { ACCEPTED_MIME_TYPES, validateImageFile } from "@/lib/image-format";
import { AD_SLOTS } from "@/lib/site";
import { TracerClient } from "@/lib/tracer-client";
import type { TraceOutput } from "@/lib/tracer-types";
import { cn } from "@/lib/utils";

type State =
  | { status: "idle" }
  | { status: "tracing"; originalUrl: string }
  | {
      status: "done";
      originalUrl: string;
      vectorUrl: string;
      result: TraceOutput;
      doc: VectorDocument;
      outline: VectorDocument | null;
      fileName: string;
      tracedAt: number;
    }
  | { status: "error"; message: string; originalUrl?: string };

const DOWNLOAD_BUTTON_ID = "download-button";

/**
 * Herramienta principal: carga de imagen → worker → WASM → visor y descarga.
 * Ajustes y paleta llegan en las Fases 1–2.
 */
export function TracerPlayground() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  /** El anuncio bajo la descarga aparece con el primer resultado y queda montado. */
  const [hasResult, setHasResult] = useState(false);
  const clientRef = useRef<TracerClient | null>(null);
  const urlsRef = useRef<string[]>([]);

  const revokeUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  useEffect(() => {
    clientRef.current = new TracerClient();
    return () => {
      clientRef.current?.dispose();
      revokeUrls();
    };
  }, [revokeUrls]);

  const handleFile = useCallback(
    async (file: Blob) => {
      const validation = await validateImageFile(file);
      if (!validation.ok) {
        setState({ status: "error", message: validation.message });
        return;
      }
      revokeUrls();
      const originalUrl = URL.createObjectURL(file);
      urlsRef.current.push(originalUrl);
      setState({ status: "tracing", originalUrl });

      try {
        const result = await clientRef.current?.trace(file, {});
        if (!result) return;
        const vectorUrl = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
        urlsRef.current.push(vectorUrl);
        setState({
          status: "done",
          originalUrl,
          vectorUrl,
          result,
          doc: parseTracedSvg(result.svg),
          outline: result.outlineSvg ? parseTracedSvg(result.outlineSvg) : null,
          fileName: file instanceof File ? file.name : "imagen",
          tracedAt: Date.now(),
        });
        setHasResult(true);
      } catch (error) {
        setState({
          status: "error",
          originalUrl,
          message: error instanceof Error ? error.message : "No se pudo vectorizar la imagen.",
        });
      }
    },
    [revokeUrls],
  );

  // Pegar desde el portapapeles (Ctrl+V) en cualquier parte de la página.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) {
        event.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  const cancel = () => {
    clientRef.current?.cancel();
    setState({ status: "idle" });
  };

  const goToDownload = () => {
    const button = document.getElementById(DOWNLOAD_BUTTON_ID);
    if (!button) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    button.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    button.focus({ preventScroll: true });
  };

  const originalUrl = state.status === "idle" ? undefined : state.originalUrl;

  return (
    <div className="flex flex-col gap-6">
      <label
        htmlFor="file-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card px-6 text-center transition-colors",
          "hover:border-primary/60 hover:bg-accent/40 focus-within:ring-[3px] focus-within:ring-ring/50",
          originalUrl ? "py-5" : "py-10",
          dragging && "border-primary bg-accent/60",
        )}
      >
        <ImageUp className={cn("text-primary", originalUrl ? "size-7" : "size-10")} aria-hidden />
        <div>
          <p className="font-medium">
            {originalUrl
              ? "Vectorizar otra imagen"
              : "Arrastra una imagen, haz clic o pega con Ctrl+V"}
          </p>
          <p className="text-sm text-muted-foreground">PNG, JPG, WEBP, BMP o GIF · hasta 30 MB</p>
        </div>
        <input
          id="file-input"
          type="file"
          accept={ACCEPTED_MIME_TYPES}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </label>

      {state.status === "error" && (
        <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {originalUrl && (
        <PreviewViewer
          originalUrl={originalUrl}
          vector={
            state.status === "done"
              ? { url: state.vectorUrl, doc: state.doc, outline: state.outline }
              : undefined
          }
          tracing={state.status === "tracing"}
          onCancel={cancel}
          onDownload={goToDownload}
        />
      )}

      {state.status === "done" && (
        <>
          <dl className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
            <Stat label="Formas" value={state.result.pathCount.toLocaleString("es")} />
            <Stat label="Colores" value={String(state.result.palette.length)} />
            <Stat label="Tiempo" value={`${state.result.elapsedMs} ms`} />
          </dl>
          <DownloadPanel
            key={state.vectorUrl}
            result={state.result}
            doc={state.doc}
            outline={state.outline}
            vectorUrl={state.vectorUrl}
            fileName={state.fileName}
            tracedAt={state.tracedAt}
            buttonId={DOWNLOAD_BUTTON_ID}
          />
        </>
      )}

      {hasResult && (
        // Separación amplia (40 px) del botón de descarga para evitar clics accidentales.
        <AdSlot slot={AD_SLOTS.belowDownload} format="rectangle" className="mt-10" />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
