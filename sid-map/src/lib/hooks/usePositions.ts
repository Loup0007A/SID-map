'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CharacterPosition } from '@/lib/types';

export function usePositions() {
  const supabase = createClient();
  const [positions, setPositions] = useState<CharacterPosition[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('list_active_positions');
    setPositions((data as CharacterPosition[]) ?? []);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    load();

    // Live : toute création/modification/suppression de position est
    // répercutée immédiatement chez tout le monde (Supabase Realtime).
    const channel = supabase
      .channel('character-positions-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'character_positions' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myPosition = positions.find((p) => p.user_id === myUserId) ?? null;

  async function setPosition(update: {
    place_id?: string | null;
    building_id?: string | null;
    route_id?: string | null;
    route_progress?: number | null;
    note?: string | null;
    is_visible?: boolean;
  }) {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'not_authenticated' };

    const { error } = await supabase.from('character_positions').upsert(
      {
        user_id: user.id,
        place_id: null,
        building_id: null,
        route_id: null,
        route_progress: null,
        note: null,
        is_visible: true,
        ...update
      },
      { onConflict: 'user_id' }
    );
    if (!error) load();
    return { error: error?.message ?? null };
  }

  async function clearPosition() {
    if (!myUserId) return;
    await supabase.from('character_positions').delete().eq('user_id', myUserId);
    load();
  }

  return { positions, myPosition, myUserId, loading, setPosition, clearPosition, reload: load };
}
