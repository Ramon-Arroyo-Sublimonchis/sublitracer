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
      <header className="text-center">
        <h2 id={`${ids}-title`} className="text-lg font-semibold tracking-tight">
          Ajustes del trazado
        </h2>
        <p className="text-sm text-muted-foreground">
          Elige cuántos colores y cuánto detalle quieres. El vector se actualiza solo.
        </p>
      </header>

      <div className="flex flex-wrap justify-center gap-x-10 gap-y-5">
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

        {/* Con muchos colores, la muestra baja de renglón en vez de ensanchar la fila. */}
        <div
          className={cn(
            "flex min-w-0 max-w-md flex-col gap-2 transition-opacity",
            retracing && "opacity-40",
          )}
        >
          <p id={`${ids}-palette`} className="text-sm font-medium">
            Colores del vector: <span className="tabular-nums">{palette.length}</span>
          </p>
          {/* Misma altura que los botones, para que los círculos queden alineados con ellos. */}
          <ul
            aria-labelledby={`${ids}-palette`}
            className="flex min-h-[42px] flex-wrap items-center gap-2"
          >
            {palette.map((color, i) => {
              const share = coverage[i];
              const text = share === undefined ? color : `${color} · ${formatShare(share)}`;
              return (
                <li key={color} title={text}>
                  <span
                    className="block size-8 rounded-full border border-foreground/20 shadow-xs"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span className="sr-only">{text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function formatShare(share: number) {
  const percent = share * 100;
  return `${percent < 1 ? "<1" : Math.round(percent)} %`;
}
