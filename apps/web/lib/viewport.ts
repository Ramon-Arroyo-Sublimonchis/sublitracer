/** Posición de la imagen dentro del visor: esquina superior izquierda (px de pantalla) y escala. */
export interface Transform {
  zoom: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_ZOOM = 0.05;
export const ZOOM_STEP = 1.25;
/** 3200 %, salvo que eso haga la imagen absurdamente grande para el navegador. */
const MAX_ZOOM = 32;
const MAX_RENDERED_SIDE = 60_000;

export function maxZoomFor(image: Size): number {
  return Math.max(1, Math.min(MAX_ZOOM, MAX_RENDERED_SIDE / Math.max(image.width, image.height)));
}

export function clampZoom(zoom: number, maxZoom: number): number {
  return Math.min(maxZoom, Math.max(MIN_ZOOM, zoom));
}

/** Encaja la imagen completa y centrada, con un margen alrededor. */
export function fitTransform(image: Size, viewport: Size, padding = 16): Transform {
  const zoom = clampZoom(
    Math.min(
      (viewport.width - 2 * padding) / image.width,
      (viewport.height - 2 * padding) / image.height,
    ),
    maxZoomFor(image),
  );
  return center(image, viewport, zoom);
}

/** Imagen centrada en el visor a una escala dada. */
export function center(image: Size, viewport: Size, zoom: number): Transform {
  return {
    zoom,
    x: (viewport.width - image.width * zoom) / 2,
    y: (viewport.height - image.height * zoom) / 2,
  };
}

/** Cambia la escala manteniendo fijo el punto de la imagen que está bajo `point`. */
export function zoomAt(t: Transform, zoom: number, point: Point, maxZoom: number): Transform {
  const next = clampZoom(zoom, maxZoom);
  const k = next / t.zoom;
  return { zoom: next, x: point.x - (point.x - t.x) * k, y: point.y - (point.y - t.y) * k };
}

/** Impide que la imagen se arrastre fuera de la vista: siempre quedan `margin` px visibles. */
export function clampPan(t: Transform, image: Size, viewport: Size, margin = 48): Transform {
  const w = image.width * t.zoom;
  const h = image.height * t.zoom;
  const mx = Math.min(margin, w);
  const my = Math.min(margin, h);
  return {
    zoom: t.zoom,
    x: Math.min(viewport.width - mx, Math.max(mx - w, t.x)),
    y: Math.min(viewport.height - my, Math.max(my - h, t.y)),
  };
}
