import type { Segment, VectorDocument, VectorPath } from "./model";

const SVG_SIZE = /<svg\b[^>]*?\bviewBox="0 0 ([\d.]+) ([\d.]+)"/;
// El color sale de `fill` (formas) o de `stroke` (contornos, con `fill="none"`).
const PATH =
  /<path\b[^>]*?\bd="([^"]*)"[^>]*?\b(?:fill|stroke)="(#[0-9a-fA-F]{6})"(?:[^>]*?\btransform="translate\(([-\d.e]+),\s*([-\d.e]+)\)")?/g;
const TOKEN = /[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

/**
 * Convierte el SVG que produce `tracer-wasm` (formas o contornos) en un
 * {@link VectorDocument}. Solo reconoce lo que emite el motor: comandos absolutos M, L, C y
 * Z, con un `translate` opcional. Los contornos pueden ser abiertos (sin Z).
 * No usa el DOM, así que funciona en workers y en Node.
 */
export function parseTracedSvg(svg: string): VectorDocument {
  const size = SVG_SIZE.exec(svg);
  if (!size) throw new Error("SVG sin viewBox: no proviene del motor de VectorizarIA");

  const paths: VectorPath[] = [];
  for (const match of svg.matchAll(PATH)) {
    const [, d, color, tx = "0", ty = "0"] = match;
    const segments = parsePathData(d, Number(tx), Number(ty));
    if (segments.length > 0) paths.push({ color: color.toLowerCase(), segments });
  }
  return { width: Number(size[1]), height: Number(size[2]), paths };
}

function parsePathData(d: string, dx: number, dy: number): Segment[] {
  const tokens = d.match(TOKEN) ?? [];
  const segments: Segment[] = [];
  let i = 0;
  const num = () => Number(tokens[i++]);
  let command = "";

  while (i < tokens.length) {
    // Las coordenadas repetidas sin letra reutilizan el último comando (sintaxis SVG).
    if (/[MLCZ]/i.test(tokens[i])) command = tokens[i++].toUpperCase();
    switch (command) {
      case "M":
        segments.push({ type: "M", x: num() + dx, y: num() + dy });
        command = "L";
        break;
      case "L":
        segments.push({ type: "L", x: num() + dx, y: num() + dy });
        break;
      case "C":
        segments.push({
          type: "C",
          x1: num() + dx,
          y1: num() + dy,
          x2: num() + dx,
          y2: num() + dy,
          x: num() + dx,
          y: num() + dy,
        });
        break;
      case "Z":
        segments.push({ type: "Z" });
        command = "";
        break;
      default:
        throw new Error(`Comando de trazado no compatible en: ${d.slice(0, 40)}…`);
    }
  }
  return segments;
}
