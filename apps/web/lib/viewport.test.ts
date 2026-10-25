import { describe, expect, it } from "vitest";

import { clampPan, fitTransform, MIN_ZOOM, maxZoomFor, zoomAt } from "./viewport";

const image = { width: 400, height: 200 };
const viewport = { width: 800, height: 600 };

describe("fitTransform", () => {
  it("encaja por el lado más restrictivo y centra", () => {
    const t = fitTransform(image, viewport, 0);
    expect(t.zoom).toBe(2); // 800 / 400
    expect(t).toMatchObject({ x: 0, y: 100 }); // (600 - 400) / 2
  });

  it("respeta el margen", () => {
    expect(fitTransform(image, viewport, 50).zoom).toBe(1.75); // (800 - 100) / 400
  });
});

describe("zoomAt", () => {
  it("mantiene fijo el píxel bajo el cursor", () => {
    const t = { zoom: 1, x: 100, y: 50 };
    const cursor = { x: 300, y: 150 };
    const before = { x: (cursor.x - t.x) / t.zoom, y: (cursor.y - t.y) / t.zoom };
    const next = zoomAt(t, 3, cursor, 32);
    expect((cursor.x - next.x) / next.zoom).toBeCloseTo(before.x);
    expect((cursor.y - next.y) / next.zoom).toBeCloseTo(before.y);
  });

  it("limita la escala", () => {
    const t = { zoom: 1, x: 0, y: 0 };
    expect(zoomAt(t, 1000, { x: 0, y: 0 }, 32).zoom).toBe(32);
    expect(zoomAt(t, 0, { x: 0, y: 0 }, 32).zoom).toBe(MIN_ZOOM);
  });
});

describe("maxZoomFor", () => {
  it("baja el máximo para imágenes enormes", () => {
    expect(maxZoomFor({ width: 500, height: 500 })).toBe(32);
    expect(maxZoomFor({ width: 6000, height: 3000 })).toBe(10);
  });
});

describe("clampPan", () => {
  it("deja al menos el margen visible", () => {
    const t = clampPan({ zoom: 1, x: -5000, y: 9000 }, image, viewport, 48);
    expect(t.x).toBe(48 - 400);
    expect(t.y).toBe(600 - 48);
  });

  it("no toca una posición válida", () => {
    const t = { zoom: 1, x: 10, y: 20 };
    expect(clampPan(t, image, viewport)).toEqual(t);
  });
});
