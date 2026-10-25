import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sitio 100 % estático: todo el procesamiento ocurre en el navegador.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  // vector-export se publica como TypeScript fuente dentro del monorepo.
  transpilePackages: ["@sublitracer/vector-export"],
};

export default nextConfig;
