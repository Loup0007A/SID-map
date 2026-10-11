'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from '@/lib/types';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_W = 12; // zoom in max

// Le monde est un carré de `world` unités de côté (100 par défaut,
// réglable par les admins). Zoom arrière max et marges en dépendent.
function clampTo(vb: ViewBox, world: number): ViewBox {
  const maxW = world * 1.3; // léger dépassement pour respirer
  const margin = world * 0.15;
  const w = Math.min(maxW, Math.max(MIN_W, vb.w));
  const h = Math.min(maxW, Math.max(MIN_W, vb.h));
  const x = Math.min(world + margin - w, Math.max(-margin, vb.x));
  const y = Math.min(world + margin - h, Math.max(-margin, vb.y));
  return { x, y, w, h };
}

export function useSvgViewport(world = 100) {
  const worldRef = useRef(world);
  worldRef.current = world;
  const clamp = useCallback((vb: ViewBox) => clampTo(vb, worldRef.current), []);
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: world, h: world });

  // La taille du monde arrive après le premier rendu (réglage chargé) ou
  // change quand un admin l'agrandit : on recadre sur la carte entière.
  const firstWorld = useRef(world);
  useEffect(() => {
    if (firstWorld.current === world) return;
    firstWorld.current = world;
    setViewBox({ x: 0, y: 0, w: world, h: world });
  }, [world]);
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
        const newW = Math.min(worldRef.current * 1.3, Math.max(MIN_W, vb.w * factor));
        const actual = newW / vb.w;
        const newH = vb.h * actual;
        const newX = before.x - (before.x - vb.x) * actual;
        const newY = before.y - (before.y - vb.y) * actual;
        return clamp({ x: newX, y: newY, w: newW, h: newH });
      });
    },
    [screenToSvg, clamp]
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
  const resetView = useCallback(() => setViewBox({ x: 0, y: 0, w: worldRef.current, h: worldRef.current }), []);

  const panTo = useCallback((x: number, y: number, targetW?: number) => {
    setViewBox((vb) => {
      const w = targetW ?? Math.min(vb.w, 35);
      const h = w * (vb.h / vb.w || 1);
      return clamp({ x: x - w / 2, y: y - h / 2, w, h });
    });
  }, []);

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

  // --- Support tactile : pincement (zoom) + déplacement à deux doigts ---
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchState = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);

  const trackPointerDown = useCallback((e: { pointerId: number; clientX: number; clientY: number }) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchState.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      };
    }
  }, []);

  // Retourne true si le mouvement a été consommé par un pincement
  // (l'appelant ne doit alors pas exécuter sa propre logique de drag).
  const trackPointerMove = useCallback((e: { pointerId: number; clientX: number; clientY: number }) => {
    if (!pointers.current.has(e.pointerId)) return false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      if (pinchState.current && svgRef.current) {
        const factor = pinchState.current.dist / Math.max(1, dist);
        zoomAt(pinchState.current.mid.x, pinchState.current.mid.y, factor);

        const rect = svgRef.current.getBoundingClientRect();
        const dx = ((mid.x - pinchState.current.mid.x) / rect.width) * viewBox.w;
        const dy = ((mid.y - pinchState.current.mid.y) / rect.height) * viewBox.h;
        setViewBox((vb) => clamp({ ...vb, x: vb.x - dx, y: vb.y - dy }));
      }
      pinchState.current = { dist, mid };
      return true;
    }
    return false;
  }, [zoomAt, viewBox.w, viewBox.h]);

  const trackPointerUp = useCallback((e: { pointerId: number }) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchState.current = null;
  }, []);

  const isMultiTouch = useCallback(() => pointers.current.size >= 2, []);

  return {
    svgRef,
    viewBox,
    viewBoxString: `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`,
    screenToSvg,
    handleWheel,
    zoomIn,
    zoomOut,
    resetView,
    panTo,
    startPan,
    doPan,
    endPan,
    isPanning,
    trackPointerDown,
    trackPointerMove,
    trackPointerUp,
    isMultiTouch
  };
}
