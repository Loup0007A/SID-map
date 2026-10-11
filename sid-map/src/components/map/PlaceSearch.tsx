'use client';

import { useState } from 'react';
import type { MapPlace } from '@/lib/types';

export default function PlaceSearch({
  places,
  onSelect,
  favoriteIds = []
}: {
  favoriteIds?: string[];
  places: MapPlace[];
  onSelect: (place: MapPlace) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = query.trim()
    ? places.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];
  const favorites = places.filter((p) => favoriteIds.includes(p.id));
  const pick = (p: MapPlace) => {
    onSelect(p);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="w-full max-w-xs">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Rechercher un lieu"
          className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[10px] uppercase tracking-wide text-paper/70 hover:text-accent"
        >
          🔍 Rechercher
        </button>
      ) : (
        <div className="anim-pop glass-strong rounded-2xl p-2">
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom d'un lieu…"
              className="w-full glass-input rounded-lg px-3 py-1.5 text-sm outline-none"
            />
            <button
              onClick={() => {
                setOpen(false);
                setQuery('');
              }}
              className="shrink-0 rounded-lg px-2 py-1.5 text-paper/50 hover:text-accent"
              aria-label="Fermer la recherche"
            >
              ✕
            </button>
          </div>
          {!query.trim() && (
            <div className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto scrollbar-thin">
              <p className="px-2.5 pt-1 font-display text-[10px] uppercase tracking-wide text-paper/45">★ Favoris</p>
              {favorites.length === 0 && (
                <p className="px-2.5 pb-1 text-xs text-paper/50">Aucun pour l'instant : ouvre un lieu et clique ☆ pour le retrouver ici.</p>
              )}
              {favorites.map((p) => (
                <button key={p.id} onClick={() => pick(p)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-paper/80 hover:bg-white/10">
                  {p.icon ?? '📍'} {p.name}
                </button>
              ))}
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <p className="mt-1.5 px-2.5 pb-1 text-xs text-paper/50">Aucun lieu ne s'appelle ainsi.</p>
          )}
          {results.length > 0 && (
            <div className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto scrollbar-thin">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-paper/80 hover:bg-white/10"
                >
                  {p.icon ?? '📍'} {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
