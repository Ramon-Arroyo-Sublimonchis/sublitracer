/** Comando de trazado en coordenadas absolutas (píxeles de la imagen, eje Y hacia abajo). */
export type Segment =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Z" };

export interface VectorPath {
  /** `#rrggbb` en minúsculas. */
  color: string;
  segments: Segment[];
}

/** Documento vectorial independiente del formato de salida. Las capas van de fondo a frente. */
export interface VectorDocument {
  width: number;
  height: number;
  paths: VectorPath[];
}

export type Rgb = [r: number, g: number, b: number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Número compacto: hasta `digits` decimales, sin ceros sobrantes ni `-0`. */
export function fmt(n: number, digits = 3): string {
  const s = n.toFixed(digits).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}
