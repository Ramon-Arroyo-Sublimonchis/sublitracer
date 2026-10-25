"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clampPan,
  fitTransform,
  MIN_ZOOM,
  maxZoomFor,
  type Point,
  type Size,
  type Transform,
  ZOOM_STEP,
  zoomAt,
} from "@/lib/viewport";

/**
 * Zoom y desplazamiento compartidos por todos los paneles del visor. Los paneles miden lo
 * mismo, así que un único `Transform` los mantiene alineados (modo Comparar).
 *
 * - `paneRef`: el panel que se mide (el del vector, presente en todos los modos).
 * - `surfaceRef`/`surfaceProps`: el contenedor de los paneles, que recibe rueda, arrastre,
 *   pellizco, doble clic y teclado.
 */
export function usePanZoom(image: Size | null) {
  const [transform, setTransform] = useState<Transform>({ zoom: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [surface, setSurface] = useState<HTMLElement | null>(null);

  const imageRef = useRef(image);
  const viewportRef = useRef<Size>({ width: 0, height: 0 });
  /** Si el usuario ya movió el zoom, no re-ajustar al cambiar el tamaño del visor. */
  const manualRef = useRef(false);
  const pointersRef = useRef(new Map<number, Point>());
  /** Panel donde empezó el gesto (con captura de puntero, `target` deja de ser el panel). */
  const gestureRectRef = useRef<DOMRect>(new DOMRect());
  const observerRef = useRef<ResizeObserver | null>(null);
  const paneElRef = useRef<HTMLElement | null>(null);

  const maxZoom = image ? maxZoomFor(image) : 1;

  const update = useCallback((next: (t: Transform) => Transform, manual = true) => {
    const img = imageRef.current;
    if (!img) return;
    syncViewport(paneElRef.current, viewportRef);
    manualRef.current = manual;
    setTransform((t) => clampPan(next(t), img, viewportRef.current));
  }, []);

  const fitToView = useCallback(() => {
    update(() => fitTransform(imageRef.current as Size, viewportRef.current), false);
  }, [update]);

  // Nueva imagen → volver a encajar.
  useEffect(() => {
    imageRef.current = image;
    if (image && syncViewport(paneElRef.current, viewportRef).width > 0) fitToView();
  }, [image, fitToView]);

  const paneRef = useCallback(
    (el: HTMLElement | null) => {
      observerRef.current?.disconnect();
      paneElRef.current = el;
      if (!el) return;
      // Medir ya: ResizeObserver avisa recién en el siguiente cuadro pintado.
      syncViewport(el, viewportRef);
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        const prev = viewportRef.current;
        viewportRef.current = { width, height };
        if (!imageRef.current || width === 0) return;
        if (!manualRef.current || prev.width === 0) {
          fitToView();
        } else {
          // Conservar el centro de la vista al cambiar de modo o de tamaño de ventana.
          const dx = (width - prev.width) / 2;
          const dy = (height - prev.height) / 2;
          update((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
        }
      });
      observer.observe(el);
      observerRef.current = observer;
    },
    [fitToView, update],
  );

  const zoomBy = useCallback(
    (factor: number, point?: Point) => {
      const max = maxZoomFor(imageRef.current ?? { width: 1, height: 1 });
      update((t) => zoomAt(t, t.zoom * factor, point ?? centerOf(viewportRef.current), max));
    },
    [update],
  );

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);
  const actualSize = useCallback(() => {
    update((t) =>
      t.zoom === 1 ? t : zoomAt(t, 1, centerOf(viewportRef.current), Number.POSITIVE_INFINITY),
    );
  }, [update]);

  // Rueda: zoom hacia el cursor. Necesita un listener no pasivo para poder cancelar el scroll.
  useEffect(() => {
    if (!surface) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      zoomBy(Math.exp(-event.deltaY * unit * 0.0015), pointInPane(surface, event));
    };
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [surface, zoomBy]);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Los controles dentro del lienzo (p. ej. "Cancelar") deben recibir su clic.
    if (event.target instanceof Element && event.target.closest("button, a, input")) return;
    if (pointersRef.current.size === 0)
      gestureRectRef.current = paneRectAt(event.currentTarget, event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const pointers = pointersRef.current;
    const prev = pointers.get(event.pointerId);
    if (!prev) return;
    const current = { x: event.clientX, y: event.clientY };

    if (pointers.size === 1) {
      update((t) => ({ ...t, x: t.x + current.x - prev.x, y: t.y + current.y - prev.y }));
    } else if (pointers.size === 2) {
      // Pellizco: escala por la distancia entre dedos, desplaza por el punto medio.
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(prev.x - other.x, prev.y - other.y);
        const after = Math.hypot(current.x - other.x, current.y - other.y);
        const rect = gestureRectRef.current;
        const mid = {
          x: (current.x + other.x) / 2 - rect.left,
          y: (current.y + other.y) / 2 - rect.top,
        };
        const max = maxZoomFor(imageRef.current ?? { width: 1, height: 1 });
        update((t) => {
          const zoomed = zoomAt(t, t.zoom * (after / Math.max(before, 1)), mid, max);
          return {
            ...zoomed,
            x: zoomed.x + (current.x - prev.x) / 2,
            y: zoomed.y + (current.y - prev.y) / 2,
          };
        });
      }
    }
    pointers.set(event.pointerId, current);
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) setDragging(false);
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLElement>) =>
    zoomBy(2, pointInPane(event.currentTarget, event));

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const actions: Record<string, () => void> = {
      "+": zoomIn,
      "=": zoomIn,
      "-": zoomOut,
      "0": fitToView,
      "1": actualSize,
    };
    const action = actions[event.key];
    if (action && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      action();
    }
  };

  return {
    transform,
    dragging,
    canZoomIn: transform.zoom < maxZoom - 1e-6,
    canZoomOut: transform.zoom > MIN_ZOOM + 1e-6,
    zoomIn,
    zoomOut,
    fit: fitToView,
    actualSize,
    paneRef,
    surfaceProps: {
      ref: setSurface,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onDoubleClick,
      onKeyDown,
    },
  };
}

/** Lee el tamaño actual del panel (si existe) y lo guarda en `ref`. */
function syncViewport(el: HTMLElement | null, ref: React.RefObject<Size>): Size {
  if (el && el.clientWidth > 0) ref.current = { width: el.clientWidth, height: el.clientHeight };
  return ref.current;
}

function centerOf(size: Size): Point {
  return { x: size.width / 2, y: size.height / 2 };
}

/**
 * Rectángulo del panel (`[data-pane]`) bajo un punto de pantalla. Se busca por coordenadas
 * y no por `event.target`: con la captura de puntero activa, los eventos llegan al contenedor.
 */
function paneRectAt(surface: Element, clientX: number, clientY: number): DOMRect {
  for (const pane of surface.querySelectorAll("[data-pane]")) {
    const rect = pane.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return rect;
    }
  }
  return surface.getBoundingClientRect();
}

function pointInPane(surface: Element, event: MouseEvent | React.MouseEvent): Point {
  const rect = paneRectAt(surface, event.clientX, event.clientY);
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
