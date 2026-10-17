'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const vbString = (vb: ViewBox) => `${+vb.x.toFixed(3)} ${+vb.y.toFixed(3)} ${+vb.w.toFixed(3)} ${+vb.h.toFixed(3)}`;

/** Niveau de détail selon le zoom (pixels par unité de carte) : les petits textes disparaissent de loin. */
function lodFor(pxPerUnit: number) {
  return pxPerUnit < 7 ? 'far' : pxPerUnit < 14 ? 'mid' : 'near';
}

/**
 * Vue de la carte (zoom, déplacement, pincement).
 *
 * Fluidité : pendant un geste, React ne redessine rien. La carte déjà
 * dessinée est simplement déplacée / agrandie par la carte graphique
 * (transform CSS, une fois par image) ; le vrai viewBox n'est recalculé
 * que quelques fois par seconde (pour remplir les bords) et à la fin du
 * geste, où l'état React est mis à jour. Les déplacements programmés
 * (zoom +/-, centrage sur un lieu) passent par le même chemin.
 */
export function useSvgViewport(world = 100) {
  const worldRef = useRef(world);
  worldRef.current = world;
  const clamp = useCallback((vb: ViewBox) => clampTo(vb, worldRef.current), []);
  const [viewBox, setViewBoxState] = useState<ViewBox>({ x: 0, y: 0, w: world, h: world });
  const svgRef = useRef<SVGSVGElement>(null);

  // Vue « vivante » (celle du <svg>), en avance sur l'état React pendant un geste.
  const live = useRef<ViewBox>(viewBox);
  // Ce qui fait bouger la vue en ce moment : doigts/souris, molette, animation.
  const sources = useRef<Set<'touch' | 'wheel' | 'anim'>>(new Set());
  const frame = useRef<number | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anim = useRef<number | null>(null);
  // Vue réellement dessinée (viewBox du <svg>) pendant un geste, et boîte du
  // <svg> avant toute transformation.
  const base = useRef<ViewBox>(viewBox);
  const box = useRef<DOMRect | null>(null);
  const lastRebase = useRef(0);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layoutBox = useCallback((): { left: number; top: number; width: number; height: number } => {
    const svg = svgRef.current;
    if (box.current && sources.current.size > 0) return box.current;
    return svg ? svg.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
  }, []);

  const setLod = (svg: SVGSVGElement, vb: ViewBox) => {
    const width = box.current?.width || svg.clientWidth;
    if (!width) return;
    const lod = lodFor(width / vb.w);
    if (svg.dataset.lod !== lod) svg.dataset.lod = lod;
  };

  // Redessine vraiment la carte pour la vue vivante.
  const rebase = (svg: SVGSVGElement) => {
    base.current = { ...live.current };
    lastRebase.current = performance.now();
    svg.setAttribute('viewBox', vbString(base.current));
    svg.style.transform = '';
    setLod(svg, base.current);
  };

  const paint = useCallback(() => {
    frame.current = null;
    const svg = svgRef.current;
    if (!svg) return;
    const lv = live.current;
    if (sources.current.size === 0) return rebase(svg);
    const { width: W, height: H } = layoutBox();
    const b = base.current;
    const s0 = Math.min(W / b.w, H / b.h) || 1;
    const s1 = Math.min(W / lv.w, H / lv.h) || 1;
    const k = s1 / s0;
    // Image trop agrandie (floue) ou trop réduite : on redessine.
    if (k > 1.6 || k < 0.62) return rebase(svg);
    const ox0 = (W - b.w * s0) / 2, oy0 = (H - b.h * s0) / 2;
    const ox1 = (W - lv.w * s1) / 2, oy1 = (H - lv.h * s1) / 2;
    const tx = ox1 - lv.x * s1 - k * (ox0 - b.x * s0);
    const ty = oy1 - lv.y * s1 - k * (oy0 - b.y * s0);
    // Une bande vide apparaît au bord (on a tiré au-delà de l'image) : on redessine.
    const gap = Math.max(tx, ty, W - (tx + k * W), H - (ty + k * H));
    if (gap > 36) return rebase(svg);
    svg.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${k.toFixed(5)})`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutBox]);

  const applyLive = useCallback(
    (vb: ViewBox) => {
      live.current = vb;
      if (frame.current == null) frame.current = requestAnimationFrame(paint);
      // Le doigt s'arrête sans lâcher : on en profite pour redessiner net.
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      pauseTimer.current = setTimeout(() => {
        pauseTimer.current = null;
        const svg = svgRef.current;
        if (svg && sources.current.size > 0 && svg.style.transform) rebase(svg);
      }, 160);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paint]
  );

  const setMoving = (on: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    // Attribut (et non classe) : React réécrit `className` à chaque rendu.
    if (on) svg.setAttribute('data-moving', '');
    else svg.removeAttribute('data-moving');
    svg.style.willChange = on ? 'transform' : '';
    if (!on) {
      if (frame.current != null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      rebase(svg);
    }
  };

  const commit = useCallback(() => {
    setViewBoxState(live.current);
  }, []);

  const begin = useCallback((src: 'touch' | 'wheel' | 'anim') => {
    // Un doigt posé arrête net une animation en cours.
    if (src !== 'anim' && anim.current != null) {
      cancelAnimationFrame(anim.current);
      anim.current = null;
      sources.current.delete('anim');
    }
    if (sources.current.size === 0) {
      const svg = svgRef.current;
      box.current = svg ? svg.getBoundingClientRect() : null;
      base.current = { ...live.current };
      lastRebase.current = performance.now();
    }
    sources.current.add(src);
    setMoving(true);
  }, []);

  const end = useCallback(
    (src: 'touch' | 'wheel' | 'anim') => {
      if (!sources.current.delete(src)) return;
      if (sources.current.size === 0) {
        setMoving(false);
        commit();
      }
    },
    [commit]
  );

  // État React -> vue vivante (chargement, taille du monde, réinitialisation).
  const setViewBox = useCallback(
    (vb: ViewBox) => {
      live.current = vb;
      setViewBoxState(vb);
    },
    []
  );

  // Après chaque rendu : si un geste est en cours, React ne doit pas remettre l'ancienne vue.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (sources.current.size > 0) svg.setAttribute('viewBox', vbString(base.current));
    else {
      live.current = viewBox;
      base.current = viewBox;
      setLod(svg, viewBox);
    }
  });

  // La taille du monde arrive après le premier rendu (réglage chargé) ou
  // change quand un admin l'agrandit : on recadre sur la carte entière.
  const firstWorld = useRef(world);
  const fitted = useRef(false);
  useEffect(() => {
    if (firstWorld.current === world && fitted.current) return;
    firstWorld.current = world;
    fitted.current = true;
    setViewBox(initialView(svgRef.current, world));
  }, [world, setViewBox]);

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

  // Point écran -> carte calculé sur la vue vivante (sans attendre que le
  // navigateur ait repeint), pour enchaîner les mouvements d'un même geste.
  const toWorld = useCallback((clientX: number, clientY: number, vb: ViewBox): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: vb.x, y: vb.y };
    const r = layoutBox();
    // preserveAspectRatio xMidYMid meet : échelle unique, vue centrée.
    const s = Math.min(r.width / vb.w, r.height / vb.h) || 1;
    const ox = r.left + (r.width - vb.w * s) / 2;
    const oy = r.top + (r.height - vb.h * s) / 2;
    return { x: vb.x + (clientX - ox) / s, y: vb.y + (clientY - oy) / s };
  }, [layoutBox]);

  const zoomAround = useCallback(
    (vb: ViewBox, clientX: number, clientY: number, factor: number): ViewBox => {
      const before = toWorld(clientX, clientY, vb);
      const newW = Math.min(worldRef.current * 1.3, Math.max(MIN_W, vb.w * factor));
      const actual = newW / vb.w;
      return clamp({ x: before.x - (before.x - vb.x) * actual, y: before.y - (before.y - vb.y) * actual, w: newW, h: vb.h * actual });
    },
    [toWorld, clamp]
  );

  // Animation douce vers une vue (zoom +/-, centrage sur un lieu).
  const animateTo = useCallback(
    (target: ViewBox, ms = 280) => {
      const from = { ...live.current };
      const to = clamp(target);
      if (anim.current != null) cancelAnimationFrame(anim.current);
      begin('anim');
      const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = reduce ? 1 : Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);
        applyLive({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e });
        if (k < 1) anim.current = requestAnimationFrame(step);
        else {
          anim.current = null;
          end('anim');
        }
      };
      anim.current = requestAnimationFrame(step);
    },
    [applyLive, clamp, begin, end]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = Math.pow(1.0015, Math.max(-120, Math.min(120, e.deltaY)));
      if (commitTimer.current) clearTimeout(commitTimer.current);
      begin('wheel');
      applyLive(zoomAround(live.current, e.clientX, e.clientY, factor));
      commitTimer.current = setTimeout(() => {
        commitTimer.current = null;
        end('wheel');
      }, 160);
    },
    [applyLive, zoomAround, begin, end]
  );

  const centerZoom = useCallback(
    (factor: number) => {
      if (!svgRef.current) return;
      const rect = layoutBox();
      animateTo(zoomAround(live.current, rect.left + rect.width / 2, rect.top + rect.height / 2, factor));
    },
    [animateTo, zoomAround, layoutBox]
  );

  const zoomIn = useCallback(() => centerZoom(1 / 1.5), [centerZoom]);
  const zoomOut = useCallback(() => centerZoom(1.5), [centerZoom]);
  const resetView = useCallback(() => {
    const w = worldRef.current;
    animateTo({ x: 0, y: 0, w, h: w }, 360);
  }, [animateTo]);

  // focusY : hauteur de l'écran où placer le point (0,5 = centre ; plus haut
  // sur téléphone, où un panneau monte du bas).
  const panTo = useCallback(
    (x: number, y: number, targetW?: number, focusY = 0.5) => {
      const vb = live.current;
      const w = targetW ?? Math.min(vb.w, 35);
      const h = w * (vb.h / vb.w || 1);
      animateTo({ x: x - w / 2, y: y - h * focusY, w, h }, 380);
    },
    [animateTo]
  );

  // --- Glisser (un doigt / souris) et pincer (deux doigts) --------------
  const panState = useRef<{ startX: number; startY: number; origin: ViewBox } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchState = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      panState.current = { startX: clientX, startY: clientY, origin: { ...live.current } };
      begin('touch');
      setIsPanning(true);
    },
    [begin]
  );

  const doPan = useCallback(
    (clientX: number, clientY: number) => {
      const st = panState.current;
      if (!st || !svgRef.current) return;
      const r = layoutBox();
      const s = Math.min(r.width / st.origin.w, r.height / st.origin.h) || 1;
      applyLive(clamp({ ...st.origin, x: st.origin.x - (clientX - st.startX) / s, y: st.origin.y - (clientY - st.startY) / s }));
    },
    [applyLive, clamp, layoutBox]
  );

  const endPan = useCallback(() => {
    if (!panState.current) return;
    panState.current = null;
    setIsPanning(false);
    if (pointers.current.size < 2) end('touch');
  }, [end]);

  const trackPointerDown = useCallback(
    (e: { pointerId: number; clientX: number; clientY: number }) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        pinchState.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        // Le pincement prend la main : le glisser reprendra au lâcher d'un doigt.
        panState.current = null;
        begin('touch');
      }
    },
    [begin]
  );

  // Retourne true si le mouvement a été consommé par un pincement
  // (l'appelant ne doit alors pas exécuter sa propre logique de drag).
  const trackPointerMove = useCallback(
    (e: { pointerId: number; clientX: number; clientY: number }) => {
      if (!pointers.current.has(e.pointerId)) return false;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size < 2) return false;
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ps = pinchState.current;
      const svg = svgRef.current;
      if (ps && svg) {
        let vb = zoomAround(live.current, ps.mid.x, ps.mid.y, ps.dist / Math.max(1, dist));
        const r = layoutBox();
        const s = Math.min(r.width / vb.w, r.height / vb.h) || 1;
        vb = clamp({ ...vb, x: vb.x - (mid.x - ps.mid.x) / s, y: vb.y - (mid.y - ps.mid.y) / s });
        applyLive(vb);
      }
      pinchState.current = { dist, mid };
      return true;
    },
    [applyLive, clamp, zoomAround, layoutBox]
  );

  const trackPointerUp = useCallback(
    (e: { pointerId: number }) => {
      if (!pointers.current.has(e.pointerId)) return;
      const wasPinch = pointers.current.size >= 2;
      pointers.current.delete(e.pointerId);
      if (wasPinch && pointers.current.size === 1) {
        pinchState.current = null;
        // Le doigt restant continue de déplacer la carte, sans saut.
        const [rest] = Array.from(pointers.current.values());
        panState.current = { startX: rest.x, startY: rest.y, origin: { ...live.current } };
        setIsPanning(true);
      } else if (pointers.current.size === 0) {
        pinchState.current = null;
        panState.current = null;
        setIsPanning(false);
        end('touch');
      }
    },
    [end]
  );

  const isMultiTouch = useCallback(() => pointers.current.size >= 2, []);

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      if (anim.current != null) cancelAnimationFrame(anim.current);
      if (commitTimer.current) clearTimeout(commitTimer.current);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
    },
    []
  );

  return {
    svgRef,
    viewBox,
    viewBoxString: vbString(viewBox),
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

/** Vue de départ : la carte entière, ou, sur un écran en hauteur (téléphone), la carte en pleine hauteur. */
function initialView(svg: SVGSVGElement | null, world: number): ViewBox {
  const r = svg?.getBoundingClientRect();
  if (!r || !r.width || !r.height) return { x: 0, y: 0, w: world, h: world };
  const aspect = r.width / r.height;
  if (aspect >= 0.8) return { x: 0, y: 0, w: world, h: world };
  const w = Math.max(MIN_W, world * aspect);
  return clampTo({ x: (world - w) / 2, y: 0, w, h: world }, world);
}
