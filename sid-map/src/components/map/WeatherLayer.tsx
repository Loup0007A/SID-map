'use client';

import { memo, useEffect, useState } from 'react';
import type { MapBiome } from '@/lib/types';
import { WEATHER_GLYPH, type WeatherNow } from '@/lib/weather';

/**
 * Météo dessinée sur les biomes (migration 0119) : pluie qui tombe, brouillard
 * flou, neige, sable, cendres… et un petit médaillon au centre de chaque biome.
 */
const TINT: Record<string, { color: string; opacity: number; pattern?: string; blur?: boolean }> = {
  nuageux: { color: '#5d6670', opacity: 0.14 },
  vent: { color: '#ffffff', opacity: 0, pattern: 'wx-wind' },
  pluie: { color: '#3d5b75', opacity: 0.12, pattern: 'wx-rain' },
  orage: { color: '#232a36', opacity: 0.3, pattern: 'wx-rain-heavy' },
  brouillard: { color: '#f4f1e8', opacity: 0.55, blur: true },
  neige: { color: '#ffffff', opacity: 0.18, pattern: 'wx-snow' },
  blizzard: { color: '#ffffff', opacity: 0.42, pattern: 'wx-snow' },
  canicule: { color: '#e0782c', opacity: 0.18, pattern: 'wx-heat' },
  tempete_sable: { color: '#c8964a', opacity: 0.38, pattern: 'wx-sand' },
  cendres: { color: '#4f4945', opacity: 0.26, pattern: 'wx-ash' },
};

function center(pts: { x: number; y: number }[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

function WeatherLayerImpl({ biomes, weather, onPick }: { biomes: MapBiome[]; weather: WeatherNow; onPick?: (biomeId: string) => void }) {
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }, []);
  const byId = new Map(weather.biomes.map((b) => [b.id, b]));
  const shown = biomes.filter((b) => b.is_published !== false && b.path_points.length >= 3 && byId.has(b.id));
  const anim = (to: string, dur: string) =>
    still ? null : <animateTransform attributeName="patternTransform" type="translate" from="0 0" to={to} dur={dur} repeatCount="indefinite" additive="sum" />;

  return (
    <g aria-hidden className="weather-layer">
      <defs>
        <pattern id="wx-rain" width={1.6} height={1.6} patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <line x1={0.4} y1={0} x2={0.4} y2={0.7} stroke="#2f4b66" strokeOpacity={0.55} strokeWidth={0.06} strokeLinecap="round" />
          <line x1={1.2} y1={0.8} x2={1.2} y2={1.4} stroke="#2f4b66" strokeOpacity={0.45} strokeWidth={0.05} strokeLinecap="round" />
          {anim('0 1.6', '0.7s')}
        </pattern>
        <pattern id="wx-rain-heavy" width={1.1} height={1.1} patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <line x1={0.3} y1={0} x2={0.3} y2={0.8} stroke="#1c2a3a" strokeOpacity={0.6} strokeWidth={0.07} strokeLinecap="round" />
          <line x1={0.85} y1={0.5} x2={0.85} y2={1.05} stroke="#1c2a3a" strokeOpacity={0.5} strokeWidth={0.06} strokeLinecap="round" />
          {anim('0 1.1', '0.45s')}
        </pattern>
        <pattern id="wx-snow" width={2.2} height={2.2} patternUnits="userSpaceOnUse">
          <circle cx={0.5} cy={0.5} r={0.14} fill="#fff" fillOpacity={0.9} />
          <circle cx={1.6} cy={1.3} r={0.1} fill="#fff" fillOpacity={0.8} />
          <circle cx={1.0} cy={1.9} r={0.08} fill="#fff" fillOpacity={0.7} />
          {anim('0.4 2.2', '3.2s')}
        </pattern>
        <pattern id="wx-ash" width={1.9} height={1.9} patternUnits="userSpaceOnUse">
          <circle cx={0.4} cy={0.6} r={0.1} fill="#2b2522" fillOpacity={0.6} />
          <circle cx={1.4} cy={1.5} r={0.07} fill="#2b2522" fillOpacity={0.5} />
          <circle cx={1.2} cy={0.3} r={0.05} fill="#b8472a" fillOpacity={0.7} />
          {anim('-0.3 1.9', '4s')}
        </pattern>
        <pattern id="wx-sand" width={3} height={1.4} patternUnits="userSpaceOnUse">
          <path d="M0 0.4 q0.75 -0.25 1.5 0 t1.5 0" fill="none" stroke="#8a5a20" strokeOpacity={0.45} strokeWidth={0.07} />
          <path d="M0.7 1.1 q0.6 -0.2 1.2 0" fill="none" stroke="#8a5a20" strokeOpacity={0.35} strokeWidth={0.05} />
          {anim('3 0', '1.6s')}
        </pattern>
        <pattern id="wx-heat" width={3} height={1.8} patternUnits="userSpaceOnUse">
          <path d="M0 0.9 q0.375 -0.3 0.75 0 t0.75 0 t0.75 0 t0.75 0" fill="none" stroke="#b5521c" strokeOpacity={0.35} strokeWidth={0.06} />
          {anim('0 -1.8', '3s')}
        </pattern>
        <pattern id="wx-wind" width={4.5} height={2.4} patternUnits="userSpaceOnUse">
          <path d="M0.2 0.8 h2 q0.6 0 0.6 -0.4" fill="none" stroke="#33414d" strokeOpacity={0.3} strokeWidth={0.06} strokeLinecap="round" />
          <path d="M1.4 1.8 h1.6" fill="none" stroke="#33414d" strokeOpacity={0.25} strokeWidth={0.05} strokeLinecap="round" />
          {anim('4.5 0', '2.4s')}
        </pattern>
        <filter id="wx-fog" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={1.2} />
        </filter>
        {shown.map((b) => (
          <clipPath key={b.id} id={`wx-clip-${b.id}`}>
            <polygon points={b.path_points.map((p) => `${p.x},${p.y}`).join(' ')} />
          </clipPath>
        ))}
      </defs>
      <g style={{ pointerEvents: 'none' }}>
        {shown.map((b) => {
          const w = byId.get(b.id)!;
          const t = TINT[w.kind];
          if (!t) return null;
          const pts = b.path_points.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <g key={b.id} clipPath={`url(#wx-clip-${b.id})`}>
              {t.opacity > 0 && <polygon points={pts} fill={t.color} fillOpacity={t.opacity} filter={t.blur ? 'url(#wx-fog)' : undefined} />}
              {t.pattern && <polygon points={pts} fill={`url(#${t.pattern})`} />}
            </g>
          );
        })}
      </g>
      {shown.map((b) => {
        const w = byId.get(b.id)!;
        const c = center(b.path_points);
        const label = weather.kinds[w.kind]?.label ?? w.kind;
        return (
          <g
            key={`b-${b.id}`}
            transform={`translate(${c.x} ${c.y})`}
            className="weather-badge cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onPick?.(b.id);
            }}
          >
            <title>{label}</title>
            <circle r={1.55} fill="#f6eedb" fillOpacity={0.92} stroke="#2e261d" strokeOpacity={0.55} strokeWidth={0.1} />
            <text textAnchor="middle" dy={0.55} fontSize={1.6}>
              {WEATHER_GLYPH[w.kind] ?? '☀️'}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default memo(WeatherLayerImpl);
