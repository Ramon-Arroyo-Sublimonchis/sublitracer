import * as Comlink from "comlink";

import type { TraceOptions, TraceOutput } from "@/lib/tracer-types";
import type { TracerWorkerApi } from "@/workers/tracer.worker";

/**
 * Cliente del worker de trazado. Cancelar termina el worker y crea uno nuevo, porque
 * una llamada WASM en curso no se puede interrumpir de otra forma.
 */
export class TracerClient {
  private worker: Worker | null = null;
  private api: Comlink.Remote<TracerWorkerApi> | null = null;
  private jobId = 0;

  private connect() {
    if (!this.api) {
      this.worker = new Worker(new URL("../workers/tracer.worker.ts", import.meta.url), {
        type: "module",
        name: "sublitracer-tracer",
      });
      this.api = Comlink.wrap<TracerWorkerApi>(this.worker);
    }
    return this.api;
  }

  /** Devuelve `null` si el trabajo quedó obsoleto (se lanzó otro o se canceló). */
  async trace(file: Blob, options: TraceOptions, maxSide = 3000): Promise<TraceOutput | null> {
    const id = ++this.jobId;
    const result = await this.connect().trace(file, options, maxSide);
    return id === this.jobId ? result : null;
  }

  cancel() {
    this.jobId++;
    this.dispose();
  }

  dispose() {
    this.api?.[Comlink.releaseProxy]();
    this.worker?.terminate();
    this.api = null;
    this.worker = null;
  }
}
