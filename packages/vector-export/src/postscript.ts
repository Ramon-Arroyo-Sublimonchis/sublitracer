import { fmt, type Segment } from "./model";

/**
 * Operadores de trazado compartidos por PDF y EPS. Los nombres cortos (`m`, `l`, `c`, `h`)
 * son los nativos de PDF; en EPS se definen como alias en el prólogo.
 */
export function pathOperators(segments: Segment[]): string {
  const out: string[] = [];
  for (const s of segments) {
    switch (s.type) {
      case "M":
        out.push(`${fmt(s.x, 2)} ${fmt(s.y, 2)} m`);
        break;
      case "L":
        out.push(`${fmt(s.x, 2)} ${fmt(s.y, 2)} l`);
        break;
      case "C":
        out.push(
          `${fmt(s.x1, 2)} ${fmt(s.y1, 2)} ${fmt(s.x2, 2)} ${fmt(s.y2, 2)} ${fmt(s.x, 2)} ${fmt(s.y, 2)} c`,
        );
        break;
      case "Z":
        out.push("h");
        break;
    }
  }
  return out.join("\n");
}

export function rgbOperand([r, g, b]: [number, number, number]): string {
  return `${fmt(r / 255)} ${fmt(g / 255)} ${fmt(b / 255)}`;
}
