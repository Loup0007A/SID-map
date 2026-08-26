'use client';

import { useCallback, useRef, useState } from 'react';
import type { Point } from '@/lib/types';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const WORLD = 100;
const MIN_W = 12; // zoom in max
const MAX_W = 130; // zoom out max (léger dépassement pour respirer)
const MARGIN = 15;

function clamp(vb: ViewBox): ViewBox {
  const w = Math.min(MAX_W, Math.max(MIN_W, vb.w));
  const h = Math.min(MAX_W, Math.max(MIN_W, vb.h));
  const x = Math.min(WORLD + MARGIN - w, Math.max(-MARGIN, vb.x));
  const y = Math.min(WORLD + MARGIN - h, Math.max(-MARGIN, vb.y));
  return { x, y, w, h };
}

export function useSvgViewport(initial: ViewBox = { x: 0, y: 0, w: WORLD, h: WORLD }) {
  const [viewBox, setViewBox] = useState<ViewBox>(initial);
  const svgRef = useRef<SVGSVGElement>(null);
  const panState = useRef<{ startX: number; startY: number; origin: ViewBox } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  // Conversion fiable écran -> coordonnées SVG, quel que soit le
  // preserveAspectRatio, le viewBox courant (zoom/pan) ou le CSS
  // appliqué au <svg>. C'est le fix du bug de positionnement du clic.
  const screenToSvg = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
  }, []);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      setViewBox((vb) => {
        const before = screenToSvg(clientX, clientY);
        const newW = Math.min(MAX_W, Math.max(MIN_W, vb.w * factor));
        const actual = newW / vb.w;
        const newH = vb.h * actual;
        const newX = before.x - (before.x - vb.x) * actual;
        const newY = before.y - (before.y - vb.y) * actual;
        return clamp({ x: newX, y: newY, w: newW, h: newH });
      });
    },
    [screenToSvg]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      zoomAt(e.clientX, e.clientY, factor);
    },
    [zoomAt]
  );

  const centerZoom = useCallback(
    (factor: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [zoomAt]
  );

  const zoomIn = useCallback(() => centerZoom(1 / 1.35), [centerZoom]);
  const zoomOut = useCallback(() => centerZoom(1.35), [centerZoom]);
  const resetView = useCallback(() => setViewBox(initial), [initial]);

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      panState.current = { startX: clientX, startY: clientY, origin: viewBox };
      setIsPanning(true);
    },
    [viewBox]
  );

  const doPan = useCallback((clientX: number, clientY: number) => {
    if (!panState.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const { startX, startY, origin } = panState.current;
    const dx = ((clientX - startX) / rect.width) * origin.w;
    const dy = ((clientY - startY) / rect.height) * origin.h;
    setViewBox(clamp({ ...origin, x: origin.x - dx, y: origin.y - dy }));
  }, []);

  const endPan = useCallback(() => {
    panState.current = null;
    setIsPanning(false);
  }, []);

  return {
    svgRef,
    viewBox,
    viewBoxString: `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`,
    screenToSvg,
    handleWheel,
    zoomIn,
    zoomOut,
    resetView,
    startPan,
    doPan,
    endPan,
    isPanning
  };
}
