'use client';

import { memo } from 'react';
import { MOTIFS, patternId, type MapTexture } from '@/lib/textures';

// Définit UNE fois chaque motif utilisé (<pattern> SVG) : peu importe
// le nombre de polygones, le navigateur ne répète qu'une petite tuile.
export function TexturePatternDef({ t, idOverride }: { t: MapTexture; idOverride?: string }) {
  const s = t.size;
  const m = MOTIFS[t.motif] ?? MOTIFS.triangle;
  const cells: [number, number][] = t.stagger ? [[0, 0], [s / 2, s / 2]] : [[0, 0]];
  const half = t.stagger ? s / 2 : s;

  return (
    <pattern
      id={idOverride ?? patternId(t.id)}
      width={s}
      height={s}
      patternUnits="userSpaceOnUse"
      patternTransform={t.rotation ? `rotate(${t.rotation})` : undefined}
    >
      {t.bg && <rect width={s} height={s} fill={t.bg} />}
      {cells.map(([cx, cy], i) => (
        <g key={i} transform={`translate(${cx} ${cy}) scale(${half / 10})`} opacity={t.opacity}>
          {t.motif === 'glyph' ? (
            <text x={5} y={5} textAnchor="middle" dominantBaseline="central" fontSize={9}>
              {t.glyph || '•'}
            </text>
          ) : (
            <path
              d={m.d}
              fill={m.fill ? t.color : 'none'}
              stroke={t.color}
              strokeWidth={m.stroke ? 0.9 : 0.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </g>
      ))}
    </pattern>
  );
}

const TextureDefs = memo(function TextureDefs({ textures }: { textures: MapTexture[] }) {
  if (textures.length === 0) return null;
  return (
    <defs>
      {textures.map((t) => (
        <TexturePatternDef key={t.id} t={t} />
      ))}
    </defs>
  );
});

export default TextureDefs;

// Petit aperçu carré d'une texture (liste de choix / éditeur).
export function TexturePreview({ t, uid, className = 'h-10 w-10' }: { t: MapTexture; uid: string; className?: string }) {
  const id = 'pv-' + uid.replace(/[^a-zA-Z0-9]/g, '_');
  // On agrandit l'échelle pour que le motif soit lisible dans 40px.
  const scaled = { ...t, size: Math.max(2, t.size) * 1 };
  return (
    <svg viewBox="0 0 12 12" className={`${className} shrink-0 rounded-md border border-white/15 bg-[#2a3a2a]`}>
      <defs>
        <TexturePatternDef t={scaled} idOverride={id} />
      </defs>
      <rect width={12} height={12} fill={`url(#${id})`} />
    </svg>
  );
}
