'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MountType } from '@/lib/types';

export function useMountTypes() {
  const supabase = createClient();
  const [mountTypes, setMountTypes] = useState<MountType[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('mount_types').select('*').order('rental_price');
    setMountTypes((data as MountType[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function byId(id: string | null): MountType | null {
    if (!id) return null;
    return mountTypes.find((m) => m.id === id) ?? null;
  }

  return { mountTypes, loading, byId, reload: load };
}
