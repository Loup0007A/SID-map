'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_SETTINGS, type MapSettings } from '@/lib/mapScale';

let cache: MapSettings | null = null;

export function useMapSettings() {
  const [settings, setSettings] = useState<MapSettings>(cache ?? DEFAULT_SETTINGS);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('map_settings').select('km_per_unit,walk_kmh,unit_label').eq('id', 1).maybeSingle();
    if (data) {
      cache = { km_per_unit: Number(data.km_per_unit), walk_kmh: Number(data.walk_kmh), unit_label: data.unit_label || 'km' };
      setSettings(cache);
    }
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

  return { settings, save, reload: load };
}
