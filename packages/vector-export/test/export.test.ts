import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import DxfParser from "dxf-parser";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  parseTracedSvg,
  resolveSize,
  toDxf,
  toEps,
  toOutlineSvg,
  toPdf,
  toPolylines,
  toSvg,
  type VectorDocument,
} from "../src";

// Mismo formato que emite tracer-wasm: fondo blanco + anillo rojo (trazado compuesto con agujero).
const ENGINE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="60" height="40" viewBox="0 0 60 40">
<path d="M0,0 L60,0 L60,40 L0,40 Z " fill="#FFFFFF" transform="translate(0,0)"/>
<path d="M0 0 C10 0 20 10 20 20 C20 30 10 40 0 40 L-10 20 Z M0 10 L5 20 L0 30 Z " fill="#DC1E1E" transform="translate(25,0)"/>
</svg>`;

const doc = parseTracedSvg(ENGINE_SVG);

describe("parseTracedSvg", () => {
  it("lee tamaño, colores y aplica el translate", () => {
    expect(doc.width).toBe(60);
    expect(doc.height).toBe(40);
    expect(doc.paths.map((p) => p.color)).toEqual(["#ffffff", "#dc1e1e"]);
    expect(doc.paths[1].segments[0]).toEqual({ type: "M", x: 25, y: 0 });
    expect(doc.paths[1].segments.filter((s) => s.type === "M")).toHaveLength(2);
  });

  it("lee contornos abiertos con stroke", () => {
    const outline =
      parseTracedSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
<path d="M0 0C1 0 2 0 3 0" fill="none" stroke="#000000"/>
<path d="M5 5C6 5 6 6 5 6Z" fill="none" stroke="#000000"/>
</svg>`);
    expect(outline.paths).toHaveLength(2);
    expect(outline.paths[0].segments.at(-1)?.type).toBe("C"); // abierto
    expect(outline.paths[1].segments.at(-1)?.type).toBe("Z");
  });

  it("rechaza SVG ajenos al motor", () => {
    expect(() => parseTracedSvg("<svg></svg>")).toThrow();
  });
});

describe("resolveSize", () => {
  it("usa 96 ppp por defecto", () => {
    expect(resolveSize(doc).mmPerPx).toBeCloseTo(25.4 / 96);
  });

  it("escala a un ancho físico y conserva la proporción", () => {
    const size = resolveSize(doc, { width: 150, unit: "mm" });
    expect(size.mmPerPx).toBeCloseTo(2.5);
    expect(size.height).toBeCloseTo(100);
  });
});

describe("toSvg", () => {
  it("relleno: un path por capa con su color", () => {
    const svg = toSvg(doc);
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).toContain('fill="#dc1e1e"');
  });

  it("contornos: sin relleno y con unidades físicas", () => {
    const svg = toSvg(doc, { drawStyle: "stroke", width: 150, unit: "mm" });
    expect(svg).toContain('width="150mm" height="100mm"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#dc1e1e"');
    expect(svg).toContain('stroke-width="0.04"'); // 0.1 mm / 2.5 mm por px
  });
});

describe("toOutlineSvg", () => {
  it("dibuja todas las formas sin relleno y con trazo de grosor constante", () => {
    const svg = toOutlineSvg(doc);
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg.match(/vector-effect="non-scaling-stroke"/g)).toHaveLength(2);
    expect(svg).toContain('fill="none"');
    expect(svg).not.toMatch(/fill="#/);
  });
});

describe("toPdf", () => {
  it("genera un PDF válido con el tamaño de página correcto", async () => {
    const bytes = await toPdf(doc, { width: 150, unit: "mm" });
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.4");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo((150 / 25.4) * 72, 1);
    expect(height).toBeCloseTo((100 / 25.4) * 72, 1);
  });

  it("la tabla xref apunta a los objetos", async () => {
    const text = new TextDecoder("latin1").decode(await toPdf(doc));
    const start = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(start, start + 4)).toBe("xref");
    const firstObj = Number(/0000000000 65535 f \n(\d{10})/.exec(text)?.[1]);
    expect(text.slice(firstObj, firstObj + 7)).toBe("1 0 obj");
  });
});

describe("toEps", () => {
  it("incluye cabecera EPSF y BoundingBox en puntos", () => {
    const eps = toEps(doc, { width: 1, unit: "in" });
    expect(eps.startsWith("%!PS-Adobe-3.0 EPSF-3.0")).toBe(true);
    expect(eps).toContain("%%BoundingBox: 0 0 72 48");
    expect(eps.match(/^fill$/gm)).toHaveLength(2);
    expect(eps.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("modo contorno usa stroke", () => {
    expect(toEps(doc, { drawStyle: "stroke" })).toMatch(/^stroke$/m);
  });
});

describe("toDxf", () => {
  it("se puede leer con un parser DXF, con una capa por color y Y invertida", () => {
    const parsed = new DxfParser().parseSync(toDxf(doc, { width: 60, unit: "mm" }));
    if (!parsed) throw new Error("DXF ilegible");
    expect(Object.keys(parsed.tables.layer.layers)).toEqual(
      expect.arrayContaining(["COLOR_FFFFFF", "COLOR_DC1E1E"]),
    );
    // fondo (1) + contorno exterior del anillo (1) + agujero (1)
    expect(parsed.entities).toHaveLength(3);
    const background = parsed.entities[0] as unknown as {
      shape: boolean;
      vertices: { x: number; y: number }[];
    };
    expect(background.shape).toBe(true);
    expect(background.vertices).toHaveLength(4);
    // (0,0) de la imagen es la esquina superior izquierda → y = alto en el DXF.
    expect(background.vertices[0]).toMatchObject({ x: 0, y: 40 });
  });

  it("aplana curvas dentro de la tolerancia", () => {
    const [outer] = toPolylines(doc.paths[1].segments, 0.05);
    expect(outer.closed).toBe(true);
    expect(outer.points.length).toBeGreaterThan(10);
    for (const [x, y] of outer.points) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
  });
});

// Prueba de punta a punta con el motor real (requiere `pnpm build:wasm`).
const wasmDir = fileURLToPath(new URL("../../tracer-wasm/pkg/", import.meta.url));
describe.skipIf(!existsSync(`${wasmDir}tracer_wasm_bg.wasm`))("con el motor WASM", () => {
  it("todas las salidas se generan a partir de un trazado real", async () => {
    const engine = await import(/* @vite-ignore */ `${wasmDir}tracer_wasm.js`);
    engine.initSync({ module: readFileSync(`${wasmDir}tracer_wasm_bg.wasm`) });

    const size = 80;
    const px = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(x - 40, y - 40);
        px.set(r < 30 && r > 12 ? [20, 90, 220, 255] : [255, 255, 255, 255], (y * size + x) * 4);
      }
    }
    const traced = engine.trace(px, size, size, {});
    const real: VectorDocument = parseTracedSvg(traced.svg);
    expect(real.paths.length).toBe(traced.pathCount);

    expect(toSvg(real)).toContain("<path");
    await expect(PDFDocument.load(await toPdf(real))).resolves.toBeTruthy();
    expect(toEps(real)).toContain("fill");
    expect(new DxfParser().parseSync(toDxf(real))?.entities.length).toBeGreaterThan(0);

    // Contorno del motor: un anillo azul sobre blanco tiene exactamente 2 fronteras
    // (exterior e interior), sin el marco de la imagen ni líneas repetidas.
    const outline = parseTracedSvg(traced.outlineSvg);
    expect(outline.paths).toHaveLength(2);
    const dxf = new DxfParser().parseSync(toDxf(outline));
    expect(dxf?.entities).toHaveLength(2);
    const radii = (dxf?.entities ?? []).map((e) => {
      const vs = (e as unknown as { vertices: { x: number; y: number }[] }).vertices;
      const cx = vs.reduce((s, v) => s + v.x, 0) / vs.length;
      const cy = vs.reduce((s, v) => s + v.y, 0) / vs.length;
      return Math.hypot(vs[0].x - cx, vs[0].y - cy);
    });
    // Radios distintos (12 y 30 px a 96 ppp → ~3.2 y ~7.9 mm): no es la misma línea dos veces.
    expect(Math.abs(radii[0] - radii[1])).toBeGreaterThan(3);
  });
});
