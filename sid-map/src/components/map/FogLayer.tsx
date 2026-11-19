'use client';

import { memo } from 'react';
import type { MapPlace, MapRoute } from '@/lib/types';

/**
 * Brouillard d'exploration : une « terra incognita » de vélin bruni posée sur
 * la carte, percée autour des lieux visités et le long des routes suivies.
 * Les bords sont flous, comme une zone laissée vierge par le cartographe.
 */
function FogLayerImpl({
  world,
  radius,
  visited,
  routes,
  places,
}: {
  world: number;
  radius: number;
  visited: MapPlace[];
  routes: MapRoute[];
  places: Map<string, MapPlace>;
}) {
  const pad = world * 0.06;
  const box = { x: -pad, y: -pad, w: world + pad * 2, h: world + pad * 2 };
  const routeLine = (r: MapRoute) => {
    const a = r.from_place_id ? places.get(r.from_place_id) : undefined;
    const b = r.to_place_id ? places.get(r.to_place_id) : undefined;
    const pts = [...(a ? [{ x: a.x, y: a.y }] : []), ...(r.path_points ?? []), ...(b ? [{ x: b.x, y: b.y }] : [])];
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
  };
  return (
    <g style={{ pointerEvents: 'none' }} aria-hidden className="fog-layer">
      <defs>
        <filter id="fog-soft" x={box.x} y={box.y} width={box.w} height={box.h} filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation={radius * 0.22} />
        </filter>
        <filter id="fog-grain" x={box.x} y={box.y} width={box.w} height={box.h} filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency={6 / world} numOctaves={4} seed={7} result="n" />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.30  0 0 0 0 0.23  0 0 0 0 0.15  0 0 0 1.7 -0.62"
          />
        </filter>
        {(['edge', 'main'] as const).map((kind) => {
          const k = kind === 'edge' ? 0.9 : 1.12;
          return (
            <mask key={kind} id={`fog-mask-${kind}`} maskUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h}>
              <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#fff" />
              <g filter="url(#fog-soft)">
                {routes.map((r) => (
                  <polyline
                    key={r.id}
                    points={routeLine(r)}
                    fill="none"
                    stroke="#000"
                    strokeWidth={radius * 0.7 * k}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {visited.map((p) => (
                  <circle key={p.id} cx={p.x} cy={p.y} r={radius * k} fill="#000" />
                ))}
              </g>
            </mask>
          );
        })}
      </defs>
      {/* Bord encré : visible juste autour de la zone dévoilée. */}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#3b2b1a" fillOpacity={0.7} mask="url(#fog-mask-edge)" />
      <g mask="url(#fog-mask-main)">
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#a38d65" />
        <rect x={box.x} y={box.y} width={box.w} height={box.h} filter="url(#fog-grain)" />
        <text
          x={world / 2}
          y={world * 0.5}
          textAnchor="middle"
          fontSize={world * 0.045}
          fill="#f1e6c8"
          fillOpacity={0.3}
          className="region-label"
          style={{ letterSpacing: world * 0.012 }}
        >
          TERRA INCOGNITA
        </text>
      </g>
    </g>
  );
}

export default memo(FogLayerImpl);
