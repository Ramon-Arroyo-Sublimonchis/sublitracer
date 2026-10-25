import type { VectorDocument } from "./model";

export type Unit = "px" | "mm" | "in";

export interface ExportOptions {
  /** `fill`: formas rellenas (impresión, vinil). `stroke`: solo contornos (corte láser). */
  drawStyle?: "fill" | "stroke";
  /** Ancho final; el alto se calcula conservando la proporción. Por defecto, 1 px = 1/96 in. */
  width?: number;
  unit?: Unit;
  /** Grosor de línea en milímetros para `stroke`. Por defecto, 0.1 mm (hairline láser). */
  strokeWidthMm?: number;
}

export interface ResolvedSize {
  drawStyle: "fill" | "stroke";
  unit: Unit;
  /** Tamaño final en la unidad pedida. */
  width: number;
  height: number;
  /** Milímetros por píxel de la imagen original. */
  mmPerPx: number;
  /** Grosor de línea en píxeles de la imagen (espacio del documento). */
  strokeWidthPx: number;
}

export const MM_PER_IN = 25.4;
export const PT_PER_MM = 72 / MM_PER_IN;
const MM_PER_UNIT: Record<Unit, number> = { px: MM_PER_IN / 96, mm: 1, in: MM_PER_IN };

export function resolveSize(doc: VectorDocument, options: ExportOptions = {}): ResolvedSize {
  const unit = options.unit ?? "px";
  const width = options.width && options.width > 0 ? options.width : null;
  const mmPerPx = width ? (width * MM_PER_UNIT[unit]) / doc.width : MM_PER_UNIT.px;
  const finalWidth = width ?? (doc.width * mmPerPx) / MM_PER_UNIT[unit];
  return {
    drawStyle: options.drawStyle ?? "fill",
    unit,
    width: finalWidth,
    height: (finalWidth * doc.height) / doc.width,
    mmPerPx,
    strokeWidthPx: (options.strokeWidthMm ?? 0.1) / mmPerPx,
  };
}
