# Sublitracer by Sublimonchis

Vectorizador de imágenes (PNG, JPG, WEBP, BMP, GIF → SVG) que corre 100 % en el navegador.
El motor está escrito en Rust sobre [visioncortex](https://github.com/visioncortex/visioncortex)
(MIT) y se compila a WebAssembly.

## Estructura

```
apps/web/              Next.js 15 (export estático), Tailwind v4, shadcn/ui
packages/tracer-wasm/  Motor de trazado en Rust → WASM (wasm-pack)
```

## Requisitos

- Node 22+, pnpm 9
- Rust estable con el target `wasm32-unknown-unknown` y `wasm-pack`
  (en Windows sin Visual Studio se usa el toolchain `x86_64-pc-windows-gnu`)

## Comandos

```bash
pnpm install
pnpm dev          # compila el WASM y levanta http://localhost:3000
pnpm build        # sitio estático en apps/web/out
pnpm lint         # Biome
cargo test --manifest-path packages/tracer-wasm/Cargo.toml
pnpm bench:trace  # calidad del trazado: colores, formas, KB, ms y ΔE (requiere build:wasm)
```

## Motor de trazado

En modo color (y blanco y negro) la imagen pasa por este pipeline:

1. Se reduce a una paleta global (k-means en OKLab).
2. Se limpian el antialias, las motas y los bordes semitransparentes.
3. Se amplía, guiada por el color original, para ubicar los bordes con precisión subpíxel.
4. Se convierte en un **mapa planar** (`planar.rs`): cada frontera entre dos colores es
   una cadena que se ajusta una sola vez y que comparten las dos formas vecinas. Por eso no
   hay huecos ni líneas dobles.
5. `geometry.rs` reconoce rectas (enderezadas a los ejes), esquinas exactas, arcos y
   círculos perfectos, y alinea los círculos concéntricos.

El resultado trae dos SVG:
- `svg`: las formas, apiladas o en recortes;
- `outlineSvg`: cada frontera una vez y sin el marco de la imagen. Lo usan la vista
  Contornos, el modo láser y el DXF.

`{ quantize: false }` vuelve a VTracer clásico. Las imágenes de prueba están en
`packages/tracer-wasm/fixtures/`, y `pnpm bench:trace` mide colores, formas, fidelidad y
porcentaje de líneas dobles.
