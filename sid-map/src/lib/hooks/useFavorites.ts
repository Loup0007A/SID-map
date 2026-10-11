'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'sid-fav-places';

// Lieux favoris, mémorisés sur l'appareil (aucune donnée envoyée au serveur).
export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(v)) setIds(v.filter((x) => typeof x === 'string'));
    } catch {
      // stockage indisponible : pas de favoris
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // le favori ne vaudra que pour cette visite
      }
      return next;
    });
  }, []);

  return { ids, has: (id: string) => ids.includes(id), toggle };
}
