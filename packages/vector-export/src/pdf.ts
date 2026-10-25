import { fmt, hexToRgb, type VectorDocument } from "./model";
import { type ExportOptions, PT_PER_MM, resolveSize } from "./options";
import { pathOperators, rgbOperand } from "./postscript";

const encoder = new TextEncoder();

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  // CompressionStream("deflate") produce formato zlib, que es justo lo que pide /FlateDecode.
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * PDF 1.4 de una página escrito a mano: el vector se conserva tal cual (sin rasterizar)
 * y no hace falta ninguna librería.
 */
export async function toPdf(doc: VectorDocument, options: ExportOptions = {}): Promise<Uint8Array> {
  const size = resolveSize(doc, options);
  const ptPerPx = size.mmPerPx * PT_PER_MM;
  const pageW = doc.width * ptPerPx;
  const pageH = doc.height * ptPerPx;
  const stroke = size.drawStyle === "stroke";

  // Matriz que pasa de píxeles (Y hacia abajo) a puntos PDF (Y hacia arriba).
  const content = [`q ${fmt(ptPerPx, 6)} 0 0 ${fmt(-ptPerPx, 6)} 0 ${fmt(pageH, 3)} cm`];
  if (stroke) content.push(`${fmt(size.strokeWidthPx, 4)} w 1 j 1 J`);
  for (const path of doc.paths) {
    const rgb = rgbOperand(hexToRgb(path.color));
    content.push(
      stroke ? `${rgb} RG` : `${rgb} rg`,
      pathOperators(path.segments),
      stroke ? "S" : "f",
    );
  }
  content.push("Q");
  const stream = await deflate(encoder.encode(content.join("\n")));

  const objects: (string | Uint8Array)[][] = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(pageW)} ${fmt(pageH)}] /Resources << >> /Contents 4 0 R >>`,
    ],
    [`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`, stream, "\nendstream"],
    ["<< /Producer (Sublitracer by Sublimonchis) /Creator (Sublitracer by Sublimonchis) >>"],
  ];

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    offset += bytes.length;
  };

  push("%PDF-1.4\n%âãÏÓ\n");
  const xref: number[] = [];
  objects.forEach((parts, i) => {
    xref.push(offset);
    push(`${i + 1} 0 obj\n`);
    for (const part of parts) push(part);
    push("\nendobj\n");
  });

  const xrefStart = offset;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const pos of xref) push(`${String(pos).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\n`);
  push(`startxref\n${xrefStart}\n%%EOF\n`);

  const out = new Uint8Array(offset);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}
