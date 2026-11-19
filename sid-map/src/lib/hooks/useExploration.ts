'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Brouillard d'exploration (migration 0118) : ce que le membre a parcouru.
 * Se recharge quand sa position change (arrivée, étape franchie).
 */
export type ExplorationState = {
  enabled: boolean;
  /** Gestion de la carte : voit tout. */
  bypass: boolean;
  radius: number;
  visited: string[];
  routes: string[];
  frontier: string[];
  total: number;
  explored: number;
  zones: { id: string; name: string; total: number; visited: number }[];
  discoverers: Record<string, { nickname: string; at: string }>;
};

export function useExploration(placeKey: string | null) {
  const [state, setState] = useState<ExplorationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('exploration_state');
    if (error) {
      // Migration 0118 pas encore passée : pas de brouillard.
      setMissing(true);
      setState(null);
    } else {
      setMissing(false);
      setState((data as ExplorationState) ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load, placeKey]);

  return { state, loading, missing, reload: load };
}
