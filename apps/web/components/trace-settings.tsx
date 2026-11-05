"use client";

import { useId } from "react";

import { Segmented } from "@/components/ui/segmented";
import type { TraceOptions } from "@/lib/tracer-types";

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

const COLOR_CHOICES = [2, 3, 4, 6, 8, 12];

const DETAIL_CHOICES: { value: Detail; label: string }[] = [
  { value: "low", label: "Bajo" },
  { value: "medium", label: "Medio" },
  { value: "high", label: "Alto" },
];

interface TraceSettingsProps {
  value: TraceSettingsValue;
  onChange: (value: TraceSettingsValue) => void;
}

export function TraceSettings({ value, onChange }: TraceSettingsProps) {
  const ids = useId();

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor={`${ids}-colors`} className="text-sm font-medium">
          Colores
        </label>
        <select
          id={`${ids}-colors`}
          value={value.colors ?? "auto"}
          onChange={(e) =>
            onChange({
              ...value,
              colors: e.target.value === "auto" ? null : Number(e.target.value),
            })
          }
          className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <option value="auto">Auto</option>
          {COLOR_CHOICES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex items-center gap-2">
        <legend className="sr-only">Detalle</legend>
        <span aria-hidden className="text-sm font-medium">
          Detalle
        </span>
        <Segmented
          name={`${ids}-detail`}
          value={value.detail}
          onChange={(detail) => onChange({ ...value, detail })}
          options={DETAIL_CHOICES}
        />
      </fieldset>
    </div>
  );
}
