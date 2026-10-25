import { fmt, hexToRgb, type VectorDocument } from "./model";
import { type ExportOptions, PT_PER_MM, resolveSize } from "./options";
import { pathOperators, rgbOperand } from "./postscript";

/** EPS 3.0 (PostScript nivel 2) para programas de impresión y corte antiguos. */
export function toEps(doc: VectorDocument, options: ExportOptions = {}): string {
  const size = resolveSize(doc, options);
  const ptPerPx = size.mmPerPx * PT_PER_MM;
  const pageW = doc.width * ptPerPx;
  const pageH = doc.height * ptPerPx;
  const stroke = size.drawStyle === "stroke";

  const out = [
    "%!PS-Adobe-3.0 EPSF-3.0",
    "%%Creator: Sublitracer by Sublimonchis",
    `%%BoundingBox: 0 0 ${Math.ceil(pageW)} ${Math.ceil(pageH)}`,
    `%%HiResBoundingBox: 0 0 ${fmt(pageW)} ${fmt(pageH)}`,
    "%%LanguageLevel: 2",
    "%%Pages: 1",
    "%%EndComments",
    "%%BeginProlog",
    "/m {moveto} bind def /l {lineto} bind def /c {curveto} bind def /h {closepath} bind def",
    "/rg {setrgbcolor} bind def",
    "%%EndProlog",
    "%%Page: 1 1",
    "gsave",
    `0 ${fmt(pageH)} translate ${fmt(ptPerPx, 6)} ${fmt(-ptPerPx, 6)} scale`,
  ];
  if (stroke) out.push(`${fmt(size.strokeWidthPx, 4)} setlinewidth 1 setlinejoin 1 setlinecap`);
  for (const path of doc.paths) {
    out.push(
      `${rgbOperand(hexToRgb(path.color))} rg newpath`,
      pathOperators(path.segments),
      stroke ? "stroke" : "fill",
    );
  }
  out.push("grestore", "showpage", "%%EOF", "");
  return out.join("\n");
}
