'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BUILTIN_TEXTURES, type MapTexture } from '@/lib/textures';

// Cache module : les textures personnalisées sont chargées une seule
// fois par session (et partagées entre toutes les cartes).
let cache: MapTexture[] | null = null;
let inflight: Promise<MapTexture[]> | null = null;

async function fetchTextures(force = false): Promise<MapTexture[]> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  const supabase = createClient();
  inflight = (async () => {
    const { data } = await supabase
      .from('map_textures')
      .select('id,name,motif,glyph,color,bg,size,opacity,rotation,stagger')
      .order('created_at');
    cache = ((data as MapTexture[]) ?? []).map((t) => ({ ...t, size: Number(t.size), opacity: Number(t.opacity), rotation: Number(t.rotation) }));
    inflight = null;
    return cache;
  })();
  return inflight;
}

export function useTextures() {
  const [custom, setCustom] = useState<MapTexture[]>(cache ?? []);

  useEffect(() => {
    let alive = true;
    fetchTextures().then((t) => alive && setCustom(t));
    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setCustom(await fetchTextures(true));
  }, []);

  return { custom, all: [...BUILTIN_TEXTURES, ...custom], reload };
}
