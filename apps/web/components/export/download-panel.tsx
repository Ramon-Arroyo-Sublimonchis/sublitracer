"use client";

import {
  type ExportOptions,
  resolveSize,
  type Unit,
  type VectorDocument,
} from "@sublitracer/vector-export";
import {
  Check,
  Download,
  DraftingCompass,
  FileCode2,
  FileImage,
  FileText,
  Info,
  Loader2,
  type LucideIcon,
  Printer,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  baseName,
  type DownloadOptions,
  downloadBlob,
  type ExportFormat,
  exportVector,
  MAX_PNG_SIDE,
} from "@/lib/export";
import type { TraceOutput } from "@/lib/tracer-types";
import { cn } from "@/lib/utils";

const FORMATS: { id: ExportFormat; label: string; hint: string; icon: LucideIcon; tint: string }[] =
  [
    { id: "svg", label: "SVG", hint: "Web y apps", icon: FileCode2, tint: "text-amber-500" },
    { id: "pdf", label: "PDF", hint: "Documentos", icon: FileText, tint: "text-red-500" },
    {
      id: "dxf",
      label: "DXF",
      hint: "CAD, láser y CNC",
      icon: DraftingCompass,
      tint: "text-rose-700",
    },
    { id: "eps", label: "EPS", hint: "Impresión clásica", icon: Printer, tint: "text-orange-500" },
    { id: "png", label: "PNG", hint: "Imagen sin fondo", icon: FileImage, tint: "text-indigo-500" },
  ];

const PNG_SCALES = [1, 2, 4] as const;
const FORMAT_KEY = "sublitracer:download-format";

interface DownloadPanelProps {
  result: TraceOutput;
  doc: VectorDocument;
  /** Contorno sin duplicados para DXF y modo láser (si el motor lo generó). */
  outline?: VectorDocument | null;
  vectorUrl: string;
  fileName: string;
  tracedAt: number;
  /** `id` del botón principal, para que la barra del visor pueda llevar el foco hasta aquí. */
  buttonId?: string;
}

export function DownloadPanel({
  result,
  doc,
  outline,
  vectorUrl,
  fileName,
  tracedAt,
  buttonId,
}: DownloadPanelProps) {
  const ids = useId();
  const [format, setFormat] = useState<ExportFormat>("svg");
  const [drawStyle, setDrawStyle] = useState<"fill" | "stroke">("fill");
  const [unit, setUnit] = useState<Unit>("px");
  const [width, setWidth] = useState<number>(result.width);
  const [pngScale, setPngScale] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recordar el último formato usado (preferencia local; si el almacenamiento falla, se ignora).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORMAT_KEY);
      if (FORMATS.some((f) => f.id === saved)) setFormat(saved as ExportFormat);
    } catch {}
  }, []);

  const chooseFormat = (id: ExportFormat) => {
    setFormat(id);
    setError(null);
    try {
      localStorage.setItem(FORMAT_KEY, id);
    } catch {}
  };

  const changeUnit = (next: Unit) => {
    // Convertir el ancho actual a la nueva unidad para no cambiar el tamaño real.
    setWidth(round((width * MM_PER[unit]) / MM_PER[next], next === "px" ? 0 : 2));
    setUnit(next);
  };

  const sizeOptions: ExportOptions = { drawStyle, width, unit };
  const resolved = resolveSize(doc, sizeOptions);
  const pngSide = Math.min(MAX_PNG_SIDE, Math.max(result.width, result.height) * pngScale);
  const pngRatio = pngSide / Math.max(result.width, result.height);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const options: DownloadOptions = { ...sizeOptions, pngScale };
      const blob = await exportVector(doc, format, options, outline);
      downloadBlob(blob, `${baseName(fileName)}.${format}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="flex flex-col gap-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
    >
      <header className="flex flex-wrap items-center gap-4">
        <div className="checkerboard size-16 shrink-0 overflow-hidden rounded-lg border">
          {/* biome-ignore lint/performance/noImgElement: miniatura de un blob local */}
          <img src={vectorUrl} alt="" className="size-full object-contain p-1" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={`${ids}-title`} className="text-xl font-semibold tracking-tight sm:text-2xl">
            Descargar
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{baseName(fileName)}</span> ·{" "}
            {result.width} × {result.height} px (
            {(result.width * result.height).toLocaleString("es")} píxeles) ·{" "}
            <RelativeTime since={tracedAt} />
          </p>
        </div>
        <Button
          id={buttonId}
          size="lg"
          onClick={download}
          disabled={busy}
          className="w-full scroll-mt-24 sm:w-auto"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Download />}
          Descargar {format.toUpperCase()}
        </Button>
      </header>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          Formato de archivo
          <span title="Todos los formatos se generan en tu navegador a partir del mismo vector.">
            <Info className="size-3.5 text-muted-foreground" aria-hidden />
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {FORMATS.map(({ id, label, hint, icon: Icon, tint }) => {
            const selected = id === format;
            return (
              <label
                key={id}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border bg-background px-3 py-4 text-center transition-colors",
                  "hover:border-primary/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                  selected && "border-primary bg-accent/50",
                )}
              >
                <input
                  type="radio"
                  name={`${ids}-format`}
                  value={id}
                  checked={selected}
                  onChange={() => chooseFormat(id)}
                  className="sr-only"
                />
                {selected && (
                  <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                )}
                <Icon className={cn("size-7", tint)} aria-hidden />
                <span className={cn("font-semibold", selected && "text-primary")}>{label}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-6 border-t pt-5 md:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Estilo de dibujo</legend>
          {format === "dxf" ? (
            <p className="text-sm text-muted-foreground">
              DXF siempre exporta contornos cerrados, con una capa por color.
            </p>
          ) : (
            <Segmented
              name={`${ids}-style`}
              value={drawStyle}
              onChange={setDrawStyle}
              options={[
                { value: "fill", label: "Formas rellenas" },
                { value: "stroke", label: "Solo contornos (láser)" },
              ]}
            />
          )}
        </fieldset>

        {format === "png" ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Escala</legend>
            <Segmented
              name={`${ids}-scale`}
              value={String(pngScale)}
              onChange={(v) => setPngScale(Number(v))}
              options={PNG_SCALES.map((s) => ({ value: String(s), label: `${s}×` }))}
            />
            <p className="text-xs text-muted-foreground">
              {Math.round(result.width * pngRatio)} × {Math.round(result.height * pngRatio)} px,
              fondo transparente
            </p>
          </fieldset>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Tamaño de salida</legend>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`${ids}-width`}>
                Ancho
              </label>
              <input
                id={`${ids}-width`}
                type="number"
                min={0.01}
                step={unit === "px" ? 1 : 0.1}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="h-9 w-28 rounded-md border bg-background px-3 text-sm tabular-nums focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              />
              <span className="text-sm text-muted-foreground">
                × {round(resolved.height, unit === "px" ? 0 : 2)}
              </span>
              <label className="sr-only" htmlFor={`${ids}-unit`}>
                Unidad
              </label>
              <select
                id={`${ids}-unit`}
                value={unit}
                onChange={(e) => changeUnit(e.target.value as Unit)}
                className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <option value="px">px</option>
                <option value="mm">mm</option>
                <option value="in">pulgadas</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              El alto se ajusta solo para conservar la proporción.
            </p>
          </fieldset>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

const MM_PER: Record<Unit, number> = { px: 25.4 / 96, mm: 1, in: 25.4 };

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function Segmented<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex w-fit flex-wrap rounded-lg border bg-muted p-1">
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
            option.value === value
              ? "bg-background font-medium shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

function RelativeTime({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.round((now - since) / 60_000);
  return <>Vectorizado {minutes < 1 ? "hace un momento" : relative.format(-minutes, "minute")}</>;
}
