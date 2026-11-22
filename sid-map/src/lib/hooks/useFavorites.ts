'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { basculerEpingle, useEpingles } from '@/components/Epingles';

const KEY = 'sid-fav-places';

/**
 * Lieux favoris (Lot 98) : ce sont les épingles « lieu » du compte
 * (migration 0125 du Dossier Central), retrouvables sur les trois sites
 * avec Ctrl+K et sur l'accueil du Dossier Central. Les favoris gardés
 * avant sur cet appareil (Lot 57) sont épinglés une fois, puis effacés.
 */
export function useFavorites() {
  const { epingles } = useEpingles('map');
  const ids = useMemo(() => (epingles ?? []).filter((e) => e.kind === 'lieu').map((e) => e.id), [epingles]);

  useEffect(() => {
    if (epingles === null) return;
    let anciens: string[] = [];
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(v)) anciens = v.filter((x) => typeof x === 'string');
    } catch {
      return;
    }
    if (!anciens.length) return;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* stockage indisponible */
    }
    void (async () => {
      for (const id of anciens) if (!ids.includes(id)) await basculerEpingle('lieu', id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epingles === null]);

  const toggle = useCallback((id: string) => {
    void basculerEpingle('lieu', id);
  }, []);

  return { ids, has: (id: string) => ids.includes(id), toggle };
}
