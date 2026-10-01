'use client';

import { useState } from 'react';
import type { CharacterPosition, MapPlace, MapRoute } from '@/lib/types';
import { useNow } from '@/lib/hooks/useNow';
import { computeProgress } from '@/lib/travel';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export default function PresencePanel({
  positions,
  places,
  routes,
  onFocusPlace
}: {
  positions: CharacterPosition[];
  places: MapPlace[];
  routes: MapRoute[];
  onFocusPlace?: (placeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const now = useNow();

  function locationLabel(p: CharacterPosition): string {
    if (p.travel_started_at) {
      const pct = Math.round(computeProgress(p, now) * 100);
      let destName = '?';
      if (p.flight_target_place_id) {
        destName = places.find((pl) => pl.id === p.flight_target_place_id)?.name ?? '?';
      } else if (p.route_id) {
        const route = routes.find((r) => r.id === p.route_id);
        const destId = route ? (route.from_place_id === p.place_id ? route.to_place_id : route.from_place_id) : null;
        destName = places.find((pl) => pl.id === destId)?.name ?? '?';
      }
      return `${p.flight_target_place_id ? '🕊️' : '🛣'} En route vers ${destName} (${pct}%)`;
    }
    if (p.place_id) {
      const place = places.find((pl) => pl.id === p.place_id);
      return `📍 ${place?.name ?? 'Lieu inconnu'}`;
    }
    return 'Position non précisée';
  }

  return (
    <div className="relative">
      {open && (
        <div className="glass-strong absolute bottom-full right-0 mb-2 max-h-[55vh] w-64 space-y-1 overflow-y-auto scrollbar-thin rounded-2xl p-3">
          <p className="mb-1 font-display text-[10px] uppercase tracking-wide text-accent">
            Présences ({positions.length})
          </p>
          {positions.length === 0 && (
            <p className="text-xs text-paper/40">Personne n'a encore indiqué sa position.</p>
          )}
          {positions.map((p) => (
            <button
              key={p.user_id}
              onClick={() => p.place_id && onFocusPlace?.(p.place_id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
            >
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px]">
                  {(p.nickname ?? '?').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-paper">{p.nickname ?? 'Membre'}</p>
                <p className="truncate text-[11px] text-paper/50">{locationLabel(p)}</p>
                {p.status && <p className="truncate text-[10px] italic text-paper/40">"{p.status}"</p>}
              </div>
              <span className="shrink-0 text-[9px] text-paper/30">{timeAgo(p.updated_at)}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[10px] uppercase tracking-wide text-paper/70 hover:text-accent"
      >
        👥 Présences {positions.length > 0 && `(${positions.length})`}
      </button>
    </div>
  );
}
