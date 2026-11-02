import {
  type ExportOptions,
  toDxf,
  toEps,
  toPdf,
  toSvg,
  type VectorDocument,
} from "@sublitracer/vector-export";

export type ExportFormat = "svg" | "pdf" | "dxf" | "eps" | "png";

export interface DownloadOptions extends ExportOptions {
  /** Solo PNG: multiplicador sobre el tamaño de la imagen vectorizada. */
  pngScale?: number;
}

/** Lado máximo del PNG: por encima de esto los navegadores fallan al crear el lienzo. */
export const MAX_PNG_SIDE = 8192;

const MIME: Record<ExportFormat, string> = {
  svg: "image/svg+xml",
  pdf: "application/pdf",
  dxf: "application/dxf",
  eps: "application/postscript",
  png: "image/png",
};

/**
 * `outline` es el contorno del motor (cada frontera una vez). Si existe, se usa para el
 * DXF y para "solo contornos": así el láser no corta dos veces la misma línea.
 */
export async function exportVector(
  doc: VectorDocument,
  format: ExportFormat,
  options: DownloadOptions,
  outline?: VectorDocument | null,
): Promise<Blob> {
  if (outline && format !== "png" && (format === "dxf" || options.drawStyle === "stroke")) {
    doc = outline;
  }
  switch (format) {
    case "svg":
      return new Blob([toSvg(doc, options)], { type: MIME.svg });
    case "pdf":
      return new Blob([(await toPdf(doc, options)) as BlobPart], { type: MIME.pdf });
    case "eps":
      return new Blob([toEps(doc, options)], { type: MIME.eps });
    case "dxf":
      return new Blob([toDxf(doc, options)], { type: MIME.dxf });
    case "png":
      return rasterize(doc, options);
  }
}

/** Renderiza el vector a PNG con fondo transparente al tamaño pedido. */
async function rasterize(doc: VectorDocument, options: DownloadOptions): Promise<Blob> {
  const scale = Math.min(options.pngScale ?? 1, MAX_PNG_SIDE / Math.max(doc.width, doc.height));
  const width = Math.round(doc.width * scale);
  const height = Math.round(doc.height * scale);
  const svg = toSvg(doc, { drawStyle: options.drawStyle, width, unit: "px" });

  const url = URL.createObjectURL(new Blob([svg], { type: MIME.svg }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el lienzo para el PNG");
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("No se pudo generar el PNG"))),
        MIME.png,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Dar tiempo al navegador a iniciar la descarga antes de liberar la URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Mi logo final.png" → "Mi logo final" (para nombrar los archivos de salida). */
export function baseName(filename: string): string {
  const name = filename.replace(/\.[^./\\]+$/, "").trim();
  return name || "vectorizaria";
}
