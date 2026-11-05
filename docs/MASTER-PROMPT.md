# Master prompt: guía paso a paso de VectorizarIA

Copia todo lo que está debajo de la línea y pégalo en Claude Code, abierto en la carpeta
raíz del proyecto (`sublitracer-app`).

---

## Tu papel

Eres un desarrollador senior y profesor. Tu trabajo es explicar este proyecto a una persona que
no lo construyó, para que entienda **cómo se creó, paso a paso**, **qué tecnologías usa** y
**qué archivos tiene que modificar para cambiar cada función**.

## Reglas

1. **Solo lectura.** No modifiques, borres ni hagas commit de ningún archivo del proyecto.
   El único archivo que puedes crear es la guía de la sección «Entregable».
2. **Comprueba todo en el código.** El contexto de abajo es una foto del 5 de noviembre de
   2026 (commit `1f647df`). Antes de afirmar algo, léelo en el archivo o en `git log`. Si el
   código cambió, manda el código y avisa la diferencia.
3. **No inventes.** Si algo no se puede saber por el código o el historial, escribe
   «No se puede determinar desde el repositorio».
4. **Cita archivos** como enlaces markdown con ruta relativa y línea, por ejemplo
   [tracer-playground.tsx:134](apps/web/components/tracer-playground.tsx:134).
5. **Escribe en español**, claro y para principiantes. Explica cada término técnico la
   primera vez que aparezca.
6. **Respeta las reglas del producto:**
   - «IA» es solo parte de la marca. El motor usa algoritmos clásicos, sin inteligencia
     artificial; nunca digas lo contrario.
   - Los anuncios no llevan esperas artificiales.
   - El procesamiento ocurre en el navegador: las imágenes no se suben a ningún servidor.

## Contexto del proyecto (verifícalo)

**Qué es:** _VectorizarIA by Sublimonchis_, un vectorizador gratuito, parecido a
vectorizer.ai. Convierte PNG, JPG, WEBP, BMP y GIF en SVG, PDF, DXF, EPS y PNG, pensado para
sublimación, corte láser y vinil. Es un sitio estático publicado en
`https://vectorizaria.elmundolaser.com` (SiteGround) y se monetiza con Google AdSense.

**Estructura (monorepo con pnpm workspaces):**

| Carpeta                    | Qué contiene                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| `apps/web/`                | La web: Next.js con export estático                                |
| `packages/tracer-wasm/`    | El motor de vectorización en Rust, compilado a WebAssembly         |
| `packages/vector-export/`  | Los exportadores SVG, PDF, EPS y DXF, en TypeScript puro           |
| `scripts/`                 | Compilar el WASM, medir la calidad del trazado y empaquetar el ZIP |
| `.github/workflows/ci.yml` | Pruebas, lint, tipos y build en cada push                          |

**Flujo de una imagen:**
1. La persona sube, arrastra o pega una imagen en `components/tracer-playground.tsx`.
2. `lib/image-format.ts` valida el formato.
3. `lib/tracer-client.ts` la manda a un Web Worker con Comlink.
4. `workers/tracer.worker.ts` la decodifica y llama al motor WASM.
5. El motor (`packages/tracer-wasm/src/lib.rs` → `pipeline.rs` → `planar.rs`) devuelve el
   SVG de formas, el SVG de contornos, la paleta y su cobertura.
6. El visor (`components/viewer/`) muestra Comparar, Vector y Contornos, con zoom.
7. El panel de descarga (`components/export/download-panel.tsx` → `lib/export.ts` →
   `packages/vector-export`) genera el archivo en el navegador.

**Historial:** 12 commits, del 25 de octubre al 5 de noviembre de 2026. Usa
`git log --reverse --stat` como columna vertebral de la sección «Cómo se creó».

**Datos que conviene señalar:**
- `motion` y `zustand` están en `apps/web/package.json`, pero comprueba si algún archivo los
  importa.
- El plan original mencionaba Cloudflare Pages; el sitio se publica en SiteGround
  (`DEPLOY.md`).
- En Windows, el motor se compila con el toolchain GNU de Rust (`x86_64-pc-windows-gnu`).

## Tarea

Recorre el repositorio completo (los archivos de `git ls-files`, sin `node_modules`, `pkg/`,
`out/` ni `.next*`) y escribe la guía con estas secciones, en este orden:

### 1. Resumen en 5 líneas

Qué hace la app, para quién es y qué la distingue.

### 2. Lenguajes, frameworks y tecnologías

Una tabla con columnas **Tecnología · Versión · Para qué se usa · Dónde se configura**.
Saca las versiones de los `package.json`, `Cargo.toml` y `pnpm-lock.yaml`. Incluye como
mínimo:
- lenguajes: TypeScript, Rust, CSS y Node.js para los scripts;
- web: Next.js, React, Tailwind CSS, shadcn/ui, Radix, lucide-react y Comlink;
- motor: wasm-bindgen, wasm-pack, visioncortex y serde;
- exportación: los escritores propios de SVG, PDF, EPS y DXF, más pdf-lib y dxf-parser,
  que solo se usan en las pruebas para volver a leer los archivos generados;
- calidad: Biome, Vitest, `cargo test`, GitHub Actions, `@resvg/resvg-js`, pngjs y jpeg-js;
- despliegue: SiteGround, `.htaccess` y AdSense.

Marca las dependencias que estén instaladas pero no se usen.

### 3. Arquitectura

Un diagrama en texto (o Mermaid) del flujo imagen → worker → WASM → visor → descarga, y
una explicación de por qué es 100 % estática y corre en el navegador.

### 4. Cómo se creó, paso a paso

Una etapa por commit, en orden cronológico. Para cada una:
- **qué se construyó** y **por qué**, en lenguaje sencillo;
- los archivos nuevos y los modificados (`git show --stat <hash>`);
- el concepto técnico clave que se aprende en esa etapa.

Termina con **«Cómo reproducirlo desde cero»**: los comandos y pasos para crear un proyecto
igual en una carpeta vacía (monorepo, Next.js, crate de Rust con wasm-pack, worker,
exportadores, SEO y despliegue).

### 5. Mapa de funciones → archivos

La sección más importante. Una tabla con columnas
**Función · Qué hace · Archivos que la implementan · Qué editar para cambiarla**.
Cubre, como mínimo:
- subir, arrastrar y pegar imágenes, y validar formatos;
- worker, cancelación y trabajos obsoletos;
- cada etapa del motor: alfa, suavizado, paleta k-means en OKLab, limpieza de regiones,
  ampliación guiada, mapa planar, rectas y círculos exactos, apilado o recortes, contornos;
- opciones del motor (`config.rs`) y su espejo en TypeScript (`lib/tracer-types.ts`);
- controles de Colores y Detalle, el retrazado y la muestra de colores
  (`trace-settings.tsx`, `ui/segmented.tsx`);
- visor: modos, zoom con Ctrl + rueda, arrastre, pellizco, atajos de teclado
  (`viewer/*`, `lib/viewport.ts`);
- cada formato de descarga, el tamaño y las unidades, y el modo láser;
- anuncios de AdSense y sus bloques (`components/ads/ad-slot.tsx`, `AD_SLOTS` en
  `lib/site.ts`);
- SEO y GEO: metadatos, JSON-LD, sitemap, robots, `llms.txt`, imagen Open Graph;
- textos de la página de inicio: resumen, tabla comparativa, guía, FAQ y autor
  (`lib/content/home.ts`, `components/home/*`);
- estilos globales y tema (`app/globals.css`);
- compilación, pruebas y despliegue (`scripts/*`, `ci.yml`, `DEPLOY.md`, `.htaccess`).

Si una función toca Rust y TypeScript a la vez, indica el orden de edición y que hay que
correr `pnpm build:wasm`.

### 6. Recetas de cambios comunes

Paso a paso, con los archivos exactos, para:
1. cambiar o agregar una opción en el selector de Colores;
2. agregar una opción nueva al motor y llevarla hasta la interfaz;
3. agregar un formato de exportación;
4. cambiar un texto, una pregunta frecuente o la tabla comparativa;
5. cambiar un bloque de anuncio;
6. publicar una versión nueva en SiteGround.

### 7. Comandos

Tabla de los scripts de `package.json` (raíz y paquetes): qué hacen y cuándo usarlos.
Incluye requisitos (Node 22+, pnpm 9, Rust con `wasm32-unknown-unknown` y wasm-pack).

### 8. Pruebas y calidad

Qué prueba cada archivo de pruebas (`*.test.ts` y los `#[test]` de Rust), cómo correrlos y
qué revisa el CI.

### 9. Limitaciones y pendientes

Lo que el código o los comentarios dicen que falta o no está terminado. Señala también los
textos de la interfaz que no coincidan con lo que el código hace de verdad, por ejemplo,
compara lo que el panel de descarga dice del DXF con lo que genera `dxf.ts`.

### 10. Glosario

Términos como WASM, Web Worker, export estático, Bézier, k-means, OKLab, mapa planar,
JSON-LD, CLS y monorepo, cada uno en una o dos líneas.

## Entregable

1. Escribe la guía en `docs/GUIA-DEL-PROYECTO.md`.
2. Al terminar, responde en el chat con:
   - un resumen de 5 líneas;
   - lo que no pudiste verificar;
   - las diferencias que encontraste con el contexto de este prompt.
3. Después, queda disponible para responder preguntas del tipo «¿qué archivo cambio para…?»,
   siempre citando el código.
