import { hexToRgb, type Rgb, type Segment, type VectorDocument } from "./model";
import { type ExportOptions, resolveSize } from "./options";

/** Colores básicos del índice de AutoCAD (ACI) para asignar a cada capa. */
const ACI: [index: number, rgb: Rgb][] = [
  [1, [255, 0, 0]],
  [2, [255, 255, 0]],
  [3, [0, 255, 0]],
  [4, [0, 255, 255]],
  [5, [0, 0, 255]],
  [6, [255, 0, 255]],
  [7, [0, 0, 0]],
  [8, [128, 128, 128]],
  [9, [192, 192, 192]],
];

function nearestAci(rgb: Rgb): number {
  let best = 7;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [index, [r, g, b]] of ACI) {
    const dist = (rgb[0] - r) ** 2 + (rgb[1] - g) ** 2 + (rgb[2] - b) ** 2;
    if (dist < bestDist) [best, bestDist] = [index, dist];
  }
  return best;
}

type Point = [x: number, y: number];

/**
 * Aplana una curva Bézier cúbica en segmentos rectos. El número de tramos sale de la
 * fórmula de Wang, que garantiza un error máximo de `tolerance` (en píxeles).
 */
function flattenCubic(p0: Point, p1: Point, p2: Point, p3: Point, tolerance: number): Point[] {
  const ddx = Math.max(Math.abs(p0[0] - 2 * p1[0] + p2[0]), Math.abs(p1[0] - 2 * p2[0] + p3[0]));
  const ddy = Math.max(Math.abs(p0[1] - 2 * p1[1] + p2[1]), Math.abs(p1[1] - 2 * p2[1] + p3[1]));
  const n = Math.min(
    64,
    Math.max(1, Math.ceil(Math.sqrt((0.75 * Math.hypot(ddx, ddy)) / tolerance))),
  );
  const points: Point[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    points.push([
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ]);
  }
  return points;
}

/** Separa un trazado compuesto en polilíneas (una por subtrazado). */
export function toPolylines(
  segments: Segment[],
  tolerance: number,
): { points: Point[]; closed: boolean }[] {
  const result: { points: Point[]; closed: boolean }[] = [];
  let current: Point[] = [];
  const flush = (closed: boolean) => {
    if (closed && current.length > 1) {
      const [fx, fy] = current[0];
      const [lx, ly] = current[current.length - 1];
      if (Math.abs(fx - lx) < 1e-6 && Math.abs(fy - ly) < 1e-6) current.pop();
    }
    if (current.length > 1) result.push({ points: current, closed });
    current = [];
  };

  for (const s of segments) {
    switch (s.type) {
      case "M":
        flush(false);
        current.push([s.x, s.y]);
        break;
      case "L":
        current.push([s.x, s.y]);
        break;
      case "C": {
        const start = current[current.length - 1] ?? [s.x1, s.y1];
        current.push(...flattenCubic(start, [s.x1, s.y1], [s.x2, s.y2], [s.x, s.y], tolerance));
        break;
      }
      case "Z":
        flush(true);
        break;
    }
  }
  flush(false);
  return result;
}

/**
 * DXF R12 (AC1009), el más compatible con LightBurn, Cricut, Silhouette, CorelDRAW e Inkscape.
 * Unidades en milímetros, una capa por color y polilíneas cerradas.
 */
export function toDxf(doc: VectorDocument, options: ExportOptions = {}): string {
  const { mmPerPx } = resolveSize(doc, options);
  const tolerance = 0.02 / mmPerPx; // 0.02 mm de error máximo al aplanar curvas
  const x = (px: number) => (px * mmPerPx).toFixed(4);
  const y = (py: number) => ((doc.height - py) * mmPerPx).toFixed(4);

  const layers = new Map<string, string>();
  for (const path of doc.paths) {
    if (!layers.has(path.color)) {
      layers.set(path.color, `COLOR_${path.color.slice(1).toUpperCase()}`);
    }
  }

  const out: (string | number)[] = [];
  const g = (code: number, value: string | number) => out.push(code, value);

  g(0, "SECTION");
  g(2, "HEADER");
  g(9, "$ACADVER");
  g(1, "AC1009");
  g(9, "$INSUNITS");
  g(70, 4);
  g(9, "$EXTMIN");
  g(10, 0);
  g(20, 0);
  g(9, "$EXTMAX");
  g(10, x(doc.width));
  g(20, y(0));
  g(0, "ENDSEC");

  g(0, "SECTION");
  g(2, "TABLES");
  g(0, "TABLE");
  g(2, "LTYPE");
  g(70, 1);
  g(0, "LTYPE");
  g(2, "CONTINUOUS");
  g(70, 0);
  g(3, "Solid line");
  g(72, 65);
  g(73, 0);
  g(40, 0);
  g(0, "ENDTAB");
  g(0, "TABLE");
  g(2, "LAYER");
  g(70, layers.size);
  for (const [color, name] of layers) {
    g(0, "LAYER");
    g(2, name);
    g(70, 0);
    g(62, nearestAci(hexToRgb(color)));
    g(6, "CONTINUOUS");
  }
  g(0, "ENDTAB");
  g(0, "ENDSEC");

  g(0, "SECTION");
  g(2, "ENTITIES");
  for (const path of doc.paths) {
    const layer = layers.get(path.color) ?? "0";
    for (const polyline of toPolylines(path.segments, tolerance)) {
      g(0, "POLYLINE");
      g(8, layer);
      g(66, 1);
      g(10, 0);
      g(20, 0);
      g(30, 0);
      g(70, polyline.closed ? 1 : 0);
      for (const [px, py] of polyline.points) {
        g(0, "VERTEX");
        g(8, layer);
        g(10, x(px));
        g(20, y(py));
        g(30, 0);
      }
      g(0, "SEQEND");
      g(8, layer);
    }
  }
  g(0, "ENDSEC");
  g(0, "EOF");

  return `${out.join("\n")}\n`;
}
