"use client";

import { useId } from "react";

import { Segmented } from "@/components/ui/segmented";
import type { TraceOptions } from "@/lib/tracer-types";
import { cn } from "@/lib/utils";

type Detail = NonNullable<TraceOptions["detail"]>;

export interface TraceSettingsValue {
  /** `null` = automático. */
  colors: number | null;
  detail: Detail;
}

export const DEFAULT_TRACE_SETTINGS: TraceSettingsValue = { colors: null, detail: "medium" };

export function toTraceOptions({ colors, detail }: TraceSettingsValue): TraceOptions {
  return colors === null ? { detail } : { colors, detail };
}

const COLOR_CHOICES = [
  { value: "auto", label: "Auto" },
  ...[2, 3, 4, 6, 8, 12].map((n) => ({ value: String(n), label: String(n) })),
];

const DETAIL_CHOICES: { value: Detail; label: string }[] = [
  { value: "low", label: "Bajo" },
  { value: "medium", label: "Medio" },
  { value: "high", label: "Alto" },
];

interface TraceSettingsProps {
  value: TraceSettingsValue;
  onChange: (value: TraceSettingsValue) => void;
  /** Colores del vector actual, de mayor a menor área. */
  palette: string[];
  /** Fracción del área de cada color de `palette` (vacío en modo clásico). */
  coverage: number[];
  /** Se está trazando con otros ajustes: la muestra va a cambiar. */
  retracing?: boolean;
}

export function TraceSettings({
  value,
  onChange,
  palette,
  coverage,
  retracing = false,
}: TraceSettingsProps) {
  const ids = useId();

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="flex flex-col gap-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
    >
      <header>
        <h2 id={`${ids}-title`} className="text-lg font-semibold tracking-tight">
          Ajustes del trazado
        </h2>
        <p className="text-sm text-muted-foreground">
          Elige cuántos colores y cuánto detalle quieres. El vector se actualiza solo.
        </p>
      </header>

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Colores</legend>
          <Segmented
            name={`${ids}-colors`}
            value={value.colors === null ? "auto" : String(value.colors)}
            onChange={(v) => onChange({ ...value, colors: v === "auto" ? null : Number(v) })}
            options={COLOR_CHOICES}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Detalle</legend>
          <Segmented
            name={`${ids}-detail`}
            value={value.detail}
            onChange={(detail) => onChange({ ...value, detail })}
            options={DETAIL_CHOICES}
          />
        </fieldset>
      </div>

      <div
        className={cn(
          "flex flex-col gap-2 border-t pt-4 transition-opacity",
          retracing && "opacity-40",
        )}
      >
        <p id={`${ids}-palette`} className="text-sm font-medium">
          Colores del vector: <span className="tabular-nums">{palette.length}</span>
        </p>
        <ul aria-labelledby={`${ids}-palette`} className="flex flex-wrap gap-1.5">
          {palette.map((color, i) => {
            const share = coverage[i];
            const text = share === undefined ? color : `${color} · ${formatShare(share)}`;
            return (
              <li key={`${color}-${i}`} title={text}>
                <span
                  className="block size-6 rounded-full border border-foreground/20"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="sr-only">{text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function formatShare(share: number) {
  const percent = share * 100;
  return `${percent < 1 ? "<1" : Math.round(percent)} %`;
}
