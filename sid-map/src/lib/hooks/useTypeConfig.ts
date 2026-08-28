'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_BUILDING_ICONS, DEFAULT_PLACE_ICONS } from '@/lib/icons';
import { BUILDING_LABELS, PLACE_LABELS } from '@/lib/types';

export interface TypeConfigItem {
  category: 'place' | 'building';
  key: string;
  label: string;
  icon: string;
  sort_order: number;
  is_custom: boolean;
}

function fallbackItems(category: 'place' | 'building'): TypeConfigItem[] {
  const icons = category === 'place' ? DEFAULT_PLACE_ICONS : DEFAULT_BUILDING_ICONS;
  const labels: Record<string, string> = category === 'place' ? PLACE_LABELS : BUILDING_LABELS;
  return Object.entries(icons).map(([key, icon], i) => ({
    category,
    key,
    label: labels[key] ?? key,
    icon,
    sort_order: i,
    is_custom: false
  }));
}

export function useTypeConfig(category: 'place' | 'building') {
  const supabase = createClient();
  const [items, setItems] = useState<TypeConfigItem[]>(fallbackItems(category));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('map_icon_config')
      .select('*')
      .eq('category', category)
      .order('sort_order');
    if (!error && data && data.length > 0) setItems(data as TypeConfigItem[]);
    else setItems(fallbackItems(category));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  async function setIcon(key: string, icon: string) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, icon } : it)));
    await supabase
      .from('map_icon_config')
      .upsert(
        { category, key, icon, label: items.find((i) => i.key === key)?.label ?? key },
        { onConflict: 'category,key' }
      );
  }

  async function addType(key: string, label: string, icon: string) {
    const sort_order = items.length + 1;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    await supabase.from('map_icon_config').insert({
      category,
      key,
      label,
      icon,
      sort_order,
      is_custom: true,
      created_by: user?.id ?? null
    });
    load();
  }

  function iconFor(key: string, fallback = '📍') {
    return items.find((i) => i.key === key)?.icon ?? fallback;
  }
  function labelFor(key: string) {
    return items.find((i) => i.key === key)?.label ?? key;
  }

  return { items, loading, reload: load, setIcon, addType, iconFor, labelFor };
}
