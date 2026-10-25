/// <reference lib="webworker" />
import init, { trace, version } from "@sublitracer/tracer-wasm";
import * as Comlink from "comlink";

import type { TraceOptions, TraceOutput } from "@/lib/tracer-types";

let wasmReady: Promise<unknown> | null = null;

function ensureWasm() {
  wasmReady ??= init();
  return wasmReady;
}

/** Decodifica la imagen (PNG/JPG/WEBP/BMP/GIF, con alfa) y la reduce si excede `maxSide`. */
async function decode(file: Blob, maxSide: number) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo crear el lienzo de decodificación");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return ctx.getImageData(0, 0, width, height);
}

const api = {
  async version() {
    await ensureWasm();
    return version();
  },

  async trace(file: Blob, options: TraceOptions, maxSide: number): Promise<TraceOutput> {
    const [image] = await Promise.all([decode(file, maxSide), ensureWasm()]);
    const started = performance.now();
    const result = trace(new Uint8Array(image.data.buffer), image.width, image.height, options);
    try {
      return {
        svg: result.svg,
        outlineSvg: result.outlineSvg,
        palette: result.palette,
        coverage: Array.from(result.coverage),
        width: result.width,
        height: result.height,
        pathCount: result.pathCount,
        elapsedMs: Math.round(performance.now() - started),
      };
    } finally {
      result.free();
    }
  },
};

export type TracerWorkerApi = typeof api;

Comlink.expose(api);
