import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Sitio 100 % estático: todo el procesamiento ocurre en el navegador.
    output: "export",
    // `next dev` usa su propia carpeta para que un `next build` no le borre los archivos
    // compilados mientras corre. (Con `output: "export"`, el build siempre compila en .next
    // y un distDir propio solo cambia la carpeta de exportación, así que no sirve para esto).
    ...(phase === PHASE_DEVELOPMENT_SERVER ? { distDir: ".next-dev" } : {}),
    images: { unoptimized: true },
    trailingSlash: true,
    reactStrictMode: true,
    // vector-export se publica como TypeScript fuente dentro del monorepo.
    transpilePackages: ["@sublitracer/vector-export"],
  };
}
