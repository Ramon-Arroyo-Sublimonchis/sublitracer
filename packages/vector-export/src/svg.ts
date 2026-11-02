import { fmt, type Segment, type VectorDocument } from "./model";
import { type ExportOptions, resolveSize } from "./options";

export function pathData(segments: Segment[]): string {
  return segments
    .map((s) => {
      if (s.type === "Z") return "Z";
      if (s.type === "C") {
        return `C${fmt(s.x1, 2)} ${fmt(s.y1, 2)} ${fmt(s.x2, 2)} ${fmt(s.y2, 2)} ${fmt(s.x, 2)} ${fmt(s.y, 2)}`;
      }
      return `${s.type}${fmt(s.x, 2)} ${fmt(s.y, 2)}`;
    })
    .join("");
}

export function toSvg(doc: VectorDocument, options: ExportOptions = {}): string {
  const size = resolveSize(doc, options);
  const unit = size.unit === "px" ? "" : size.unit;
  const stroke = size.drawStyle === "stroke";
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- Generado con VectorizarIA by Sublimonchis -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${fmt(size.width)}${unit}" height="${fmt(size.height)}${unit}" viewBox="0 0 ${doc.width} ${doc.height}">`,
  ];
  if (stroke) {
    lines.push(
      `<g fill="none" stroke-width="${fmt(size.strokeWidthPx, 4)}" stroke-linejoin="round" stroke-linecap="round">`,
    );
  }
  for (const path of doc.paths) {
    const paint = stroke ? `stroke="${path.color}"` : `fill="${path.color}"`;
    lines.push(`<path d="${pathData(path.segments)}" ${paint}/>`);
  }
  if (stroke) lines.push("</g>");
  lines.push("</svg>", "");
  return lines.join("\n");
}

/**
 * Vista de contornos para el visor: todas las formas sin relleno, con una línea de grosor
 * constante en pantalla (`non-scaling-stroke`), sin importar el zoom.
 */
export function toOutlineSvg(doc: VectorDocument, color = "#1f2937"): string {
  // `vector-effect` no se hereda: debe ir en cada path.
  const paths = doc.paths.map(
    (path) => `<path d="${pathData(path.segments)}" vector-effect="non-scaling-stroke"/>`,
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">`,
    `<g fill="none" stroke="${color}" stroke-width="1" stroke-linejoin="round">`,
    ...paths,
    "</g>",
    "</svg>",
    "",
  ].join("\n");
}
