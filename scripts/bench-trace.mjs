// Mide la calidad del motor de trazado sobre un conjunto fijo de imágenes.
//
//   pnpm build:wasm && pnpm bench:trace            # todas las fixtures, pipeline nuevo vs. clásico
//   pnpm bench:trace -- --only=logo --opts='{"colors":12}'
//
// Por cada imagen reporta colores, formas, tamaño del SVG, tiempo y fidelidad: el SVG se
// rasteriza con resvg y se compara con el original (ΔE medio en OKLab ×100, ambos sobre blanco).
// Escribe SVG y PNG en bench-out/ para revisarlos a ojo.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmDir = join(root, "packages", "tracer-wasm", "pkg");
const fixturesDir = join(root, "packages", "tracer-wasm", "fixtures");
const outDir = join(root, "bench-out");

const engine = await import(new URL(`file:///${join(wasmDir, "tracer_wasm.js")}`).href);
engine.initSync({ module: readFileSync(join(wasmDir, "tracer_wasm_bg.wasm")) });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  }),
);
const extraOptions = args.opts ? JSON.parse(args.opts) : {};

// ---------- imágenes ----------

function loadFile(name) {
  const buf = readFileSync(join(fixturesDir, name));
  if (name.endsWith(".png")) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  }
  const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { width: img.width, height: img.height, data: new Uint8Array(img.data) };
}

/** Rasteriza con supermuestreo 4×4 (antialias real, como un PNG exportado de un editor). */
function synth(width, height, paint) {
  const data = new Uint8Array(width * height * 4);
  const S = 4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = paint(x + (sx + 0.5) / S, y + (sy + 0.5) / S);
          if (!c) continue;
          r += c[0];
          g += c[1];
          b += c[2];
          a += 255;
        }
      }
      const n = S * S;
      const covered = a / 255;
      const i = (y * width + x) * 4;
      data[i] = covered ? r / covered : 0;
      data[i + 1] = covered ? g / covered : 0;
      data[i + 2] = covered ? b / covered : 0;
      data[i + 3] = a / n;
    }
  }
  return { width, height, data };
}

const FIXTURES = {
  logo: () => loadFile("el-mundo-laser-logo.png"),
  foto: () => loadFile("portada-foto.jpg"),
  plano: () =>
    synth(400, 400, (x, y) => {
      const d = Math.hypot(x - 200, y - 200);
      if (d < 120 && Math.abs(x - 200) < 40) return [255, 255, 255];
      if (d < 150) return [220, 38, 38];
      if (d < 175) return [255, 255, 255];
      if (d < 190) return [30, 41, 59];
      return null; // transparente
    }),
  // Emblema circular tipo logo: anillos concéntricos, estrellas y "letras" blancas sobre
  // fondo blanco opaco. Es el caso típico de corte/grabado.
  emblema: () => {
    const c = 250;
    const star = (cx, cy, r) =>
      Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.4 : r;
        return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
      });
    const inPoly = (poly, x, y) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const stars = [star(c - 205, c, 16), star(c + 205, c, 16), star(c, c - 95, 22)];
    // "Letras": bloques rotados sobre el anillo de texto.
    const letters = Array.from({ length: 14 }, (_, i) => -Math.PI * 0.9 + (i * Math.PI * 0.8) / 13);
    const inLetter = (x, y) =>
      letters.some((a) => {
        const dx = x - c;
        const dy = y - c;
        const u = dx * Math.cos(a) + dy * Math.sin(a) - 192; // radial
        const v = -dx * Math.sin(a) + dy * Math.cos(a); // tangencial
        return Math.abs(u) < 22 && Math.abs(v) < 9 && !(Math.abs(u) < 10 && Math.abs(v) < 3);
      });
    const pink = [236, 72, 153];
    const white = [255, 255, 255];
    return synth(500, 500, (x, y) => {
      const d = Math.hypot(x - c, y - c);
      if (d > 245) return white; // fondo
      if (d > 238) return pink;
      if (d > 233) return white; // aro fino exterior
      if (d > 155)
        return inLetter(x, y) || stars.slice(0, 2).some((p) => inPoly(p, x, y)) ? white : pink;
      if (d > 147) return white; // aro interior
      if (inPoly(stars[2], x, y)) return white;
      if (Math.hypot(x - c, y - c + 10) < 45) return white; // "cara"
      if (Math.abs(x - c) < 60 && y > c + 40 && y < c + 120 && Math.abs(x - c) > 20) return white;
      return pink;
    });
  },
  degradado: () =>
    synth(400, 300, (x, y) => {
      const t = x / 400;
      const sky = [40 + 180 * t, 90 + 100 * t, 200];
      if (Math.hypot(x - 280, y - 90) < 45) return [250, 204, 21];
      if (y > 200 + 30 * Math.sin(x / 40)) return [22, 101, 52];
      return sky;
    }),
};

// ---------- color ----------

const srgbToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
function oklab(r, g, b) {
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const overWhite = (c, a) => c * (a / 255) + 255 * (1 - a / 255);

function meanDeltaE(a, b) {
  let sum = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const p = oklab(
      overWhite(a[i], a[i + 3]),
      overWhite(a[i + 1], a[i + 3]),
      overWhite(a[i + 2], a[i + 3]),
    );
    const q = oklab(
      overWhite(b[i], b[i + 3]),
      overWhite(b[i + 1], b[i + 3]),
      overWhite(b[i + 2], b[i + 3]),
    );
    sum += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  return (sum / n) * 100;
}

// ---------- contornos ----------

/** Puntos cada ~0.5 px a lo largo de cada ruta (M, L, C, Z absolutos). */
function samplePaths(svg) {
  const paths = [];
  const pathRe =
    /<path\b[^>]*?\bd="([^"]*)"[^>]*?(?:transform="translate\(([-\d.e]+),([-\d.e]+)\)")?/g;
  for (const m of svg.matchAll(pathRe)) {
    const [tx, ty] = [Number(m[2] ?? 0), Number(m[3] ?? 0)];
    const tokens = m[1].match(/[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
    const pts = [];
    let i = 0;
    let cmd = "";
    let cur = [0, 0];
    let start = [0, 0];
    const num = () => Number(tokens[i++]);
    const line = (a, b) => {
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
      for (let k = 1; k <= n; k++)
        pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    };
    while (i < tokens.length) {
      if (/[MLCZ]/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
      if (cmd === "M") {
        cur = start = [num() + tx, num() + ty];
        pts.push(cur);
        cmd = "L";
      } else if (cmd === "L") {
        const p = [num() + tx, num() + ty];
        line(cur, p);
        cur = p;
      } else if (cmd === "C") {
        const c1 = [num() + tx, num() + ty];
        const c2 = [num() + tx, num() + ty];
        const p = [num() + tx, num() + ty];
        const n = Math.max(2, Math.ceil(Math.hypot(p[0] - cur[0], p[1] - cur[1]) * 3));
        for (let k = 1; k <= n; k++) {
          const t = k / n;
          const u = 1 - t;
          pts.push(
            [0, 1].map(
              (j) =>
                u * u * u * cur[j] +
                3 * u * u * t * c1[j] +
                3 * u * t * t * c2[j] +
                t * t * t * p[j],
            ),
          );
        }
        cur = p;
      } else if (cmd === "Z") {
        line(cur, start);
        cur = start;
        cmd = "";
      } else i++;
    }
    paths.push(pts);
  }
  return paths;
}

/**
 * Líneas del contorno y porcentaje de su longitud que corre "doble": a menos de 0.75 px
 * de otra ruta (lejos de los extremos, donde las rutas se tocan a propósito).
 */
function contourStats(svg) {
  const paths = samplePaths(svg);
  const grid = new Map();
  const key = (x, y) => `${Math.floor(x)},${Math.floor(y)}`;
  paths.forEach((pts, id) => {
    for (const p of pts) {
      const k = key(p[0], p[1]);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push([p[0], p[1], id]);
    }
  });
  let total = 0;
  let dup = 0;
  paths.forEach((pts, id) => {
    const a = pts[0];
    const b = pts[pts.length - 1];
    for (const p of pts) {
      if (Math.hypot(p[0] - a[0], p[1] - a[1]) < 2 || Math.hypot(p[0] - b[0], p[1] - b[1]) < 2)
        continue;
      total++;
      let near = false;
      for (let dx = -1; dx <= 1 && !near; dx++) {
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (const q of grid.get(key(p[0] + dx, p[1] + dy)) ?? []) {
            if (q[2] !== id && Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.75) {
              near = true;
              break;
            }
          }
        }
      }
      if (near) dup++;
    }
  });
  return { lines: paths.length, dupPct: total ? (100 * dup) / total : 0 };
}

const asStroke = (svg) =>
  svg
    .replace(/fill="#[0-9a-fA-F]{6}"/g, 'fill="none" stroke="#000000"')
    .replace(/stroke="#000000"/g, 'stroke="#000000" stroke-width="0.5"');

// ---------- corrida ----------

const VARIANTS = {
  clasico: { quantize: false },
  nuevo: {},
};

mkdirSync(outDir, { recursive: true });
const rows = [];
for (const [name, load] of Object.entries(FIXTURES)) {
  if (args.only && args.only !== name) continue;
  const img = load();
  writeFileSync(
    join(outDir, `${name}-original.png`),
    PNG.sync.write(
      Object.assign(new PNG({ width: img.width, height: img.height }), {
        data: Buffer.from(img.data),
      }),
    ),
  );
  for (const [variant, base] of Object.entries(VARIANTS)) {
    const options = { ...base, ...(variant === "nuevo" ? extraOptions : {}) };
    const t0 = performance.now();
    const result = engine.trace(img.data, img.width, img.height, options);
    const ms = performance.now() - t0;
    const svg = result.svg;
    const raster = new Resvg(svg, { fitTo: { mode: "width", value: img.width } }).render();
    writeFileSync(join(outDir, `${name}-${variant}.svg`), svg);
    writeFileSync(join(outDir, `${name}-${variant}.png`), raster.asPng());
    // Contorno: el del motor (cada frontera una vez) o, en clásico, el de las formas.
    const outline = result.outlineSvg || svg;
    const contour = contourStats(outline);
    const outlineRender = new Resvg(asStroke(outline), {
      background: "white",
      fitTo: { mode: "width", value: img.width * 2 },
    }).render();
    writeFileSync(join(outDir, `${name}-${variant}-contorno.png`), outlineRender.asPng());
    rows.push({
      imagen: `${name} ${img.width}×${img.height}`,
      variante: variant,
      colores: result.palette.length,
      formas: result.pathCount,
      "svg KB": Math.round(svg.length / 1024),
      ms: Math.round(ms),
      "ΔE×100": meanDeltaE(img.data, raster.pixels).toFixed(2),
      líneas: contour.lines,
      "doble %": contour.dupPct.toFixed(1),
    });
    result.free();
  }
}
console.table(rows);
console.log(`Resultados en ${outDir}`);
