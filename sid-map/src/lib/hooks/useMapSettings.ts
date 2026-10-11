'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_SETTINGS, type MapSettings } from '@/lib/mapScale';

let cache: MapSettings | null = null;

export function useMapSettings() {
  const [settings, setSettings] = useState<MapSettings>(cache ?? DEFAULT_SETTINGS);
  const [ready, setReady] = useState(cache !== null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('map_settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      cache = { km_per_unit: Number(data.km_per_unit), walk_kmh: Number(data.walk_kmh), unit_label: data.unit_label || 'km',
        // colonne absente tant que la migration 0112 n'est pas jouée
        world_size: Number(data.world_size) >= 100 ? Number(data.world_size) : 100
      };
      setSettings(cache);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (next: MapSettings) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('map_settings')
        .upsert({ id: 1, ...next, updated_at: new Date().toISOString() });
      if (!error) {
        cache = next;
        setSettings(next);
      }
      return { error: error?.message ?? null };
    },
    []
  );

  return { settings, ready, save, reload: load };
}
