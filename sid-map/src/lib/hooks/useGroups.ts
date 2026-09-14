'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MapGroup } from '@/lib/types';

export function useGroups() {
  const supabase = createClient();
  const [groups, setGroups] = useState<MapGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('list_groups_for_map').then(({ data, error }) => {
      if (!error) setGroups((data as MapGroup[]) ?? []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function labelFor(id: string | null): string | null {
    if (!id) return null;
    return groups.find((g) => g.id === id)?.label ?? null;
  }

  return { groups, loading, labelFor };
}
