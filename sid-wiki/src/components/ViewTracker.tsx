'use client';

import { useEffect } from 'react';

export const RECENT_KEY = 'wiki-recent-views';
export type Viewed = { category: string; number: number; title: string; at: number };

/** Mémorise (dans ce navigateur uniquement) les 12 dernières fiches consultées. */
export default function ViewTracker({ category, number, title }: { category: string; number: number; title: string }) {
  useEffect(() => {
    try {
      const list: Viewed[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
      const next = [{ category, number, title, at: Date.now() }, ...list.filter((v) => !(v.category === category && v.number === number))].slice(0, 12);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  }, [category, number, title]);
  return null;
}
