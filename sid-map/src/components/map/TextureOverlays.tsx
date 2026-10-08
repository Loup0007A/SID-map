'use client';

import { memo, useMemo } from 'react';
import type { MapBiome, MapRelief, Point } from '@/lib/types';
import {
  BIOME_DEFAULT_TEXTURE,
  findTexture,
  patternId,
  reliefDefaultTexture,
  type MapTexture
} from '@/lib/textures';
import TextureDefs from './TextureDefs';

const toSvg = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

// Calque de textures, mémoïsé : ne se recalcule que si les données
// changent (pas à chaque zoom/déplacement). Les motifs ne sont définis
// que pour les textures réellement utilisées.
const TextureOverlays = memo(function TextureOverlays({
  biomes,
  relief,
  custom,
  showBiomes,
  showRelief
}: {
  biomes: MapBiome[];
  relief: MapRelief[];
  custom: MapTexture[];
  showBiomes: boolean;
  showRelief: boolean;
}) {
  const { items, used } = useMemo(() => {
    const items: { key: string; points: string; texId: string }[] = [];
    const usedMap = new Map<string, MapTexture>();

    const add = (key: string, pts: Point[], texId: string | null) => {
      const tex = findTexture(texId, custom);
      if (!tex || pts.length < 3) return;
      usedMap.set(tex.id, tex);
      items.push({ key, points: toSvg(pts), texId: tex.id });
    };

    if (showBiomes)
      biomes.forEach((b) =>
        add('b' + b.id, b.path_points, b.texture_id === 'none' ? null : b.texture_id ?? BIOME_DEFAULT_TEXTURE[b.biome_type] ?? null)
      );
    if (showRelief)
      relief.forEach((r) =>
        add('r' + r.id, r.path_points, r.texture_id === 'none' ? null : r.texture_id ?? reliefDefaultTexture(r.elevation))
      );

    return { items, used: Array.from(usedMap.values()) };
  }, [biomes, relief, custom, showBiomes, showRelief]);

  if (items.length === 0) return null;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <TextureDefs textures={used} />
      {items.map((it) => (
        <polygon key={it.key} points={it.points} fill={`url(#${patternId(it.texId)})`} />
      ))}
    </g>
  );
});

export default TextureOverlays;
