/** Espejo de `TraceOptions` del crate Rust (camelCase). Todos los campos son opcionales. */
export interface TraceOptions {
  /** Paleta global antes de trazar (por defecto `true`); `false` = VTracer clásico. */
  quantize?: boolean;
  /** Número de colores; sin valor = automático. */
  colors?: number;
  detail?: "low" | "medium" | "high";
  /** Ampliación interna 1–4; sin valor = automática según el tamaño. */
  upscale?: number;
  alphaThreshold?: number;
  /** Reconocer rectas, arcos y círculos exactos (por defecto `true`). */
  geometry?: boolean;
  /** `remove` quita la región que ocupa la mayor parte del borde de la imagen. */
  background?: "keep" | "remove";
  colorMode?: "color" | "binary";
  hierarchical?: "stacked" | "cutout";
  mode?: "pixel" | "polygon" | "spline";
  filterSpeckle?: number;
  colorPrecision?: number;
  layerDifference?: number;
  cornerThreshold?: number;
  lengthThreshold?: number;
  maxIterations?: number;
  spliceThreshold?: number;
  binaryThreshold?: number;
  pathPrecision?: number;
}

export interface TraceOutput {
  /** Formas rellenas. */
  svg: string;
  /**
   * Contornos: cada frontera entre colores una sola vez y sin el marco de la imagen
   * (vista de contornos, corte láser, DXF). Vacío en modo clásico.
   */
  outlineSvg: string;
  palette: string[];
  /** Fracción del área opaca de cada color de `palette` (vacío en modo clásico). */
  coverage: number[];
  width: number;
  height: number;
  pathCount: number;
  elapsedMs: number;
}
