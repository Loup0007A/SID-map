'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MapPlace, MapRoute } from '@/lib/types';
import { findShortestPath, type RoutePlan } from '@/lib/pathfinding';

function PlacePicker({
  label,
  places,
  value,
  onChange
}: {
  label: string;
  places: MapPlace[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = places.find((p) => p.id === value);
  const results = query.trim()
    ? places.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wide text-paper/50">{label}</label>
      <input
        value={selected ? selected.name : query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        onFocus={() => setQuery('')}
        placeholder="Rechercher…"
        className="w-full glass-input rounded-lg px-3 py-1.5 text-sm outline-none"
      />
      {results.length > 0 && (
        <div className="max-h-32 space-y-0.5 overflow-y-auto scrollbar-thin">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p.id);
                setQuery('');
              }}
              className="block w-full rounded-lg px-2 py-1 text-left text-xs text-paper/80 hover:bg-white/10"
            >
              {p.icon ?? '📍'} {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RoutePlannerPanel({
  places,
  routes,
  onClose,
  onHighlight
}: {
  places: MapPlace[];
  routes: MapRoute[];
  onClose: () => void;
  onHighlight: (plan: RoutePlan | null) => void;
}) {
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);

  const plan = useMemo(() => {
    if (!fromId || !toId) return null;
    return findShortestPath(fromId, toId, routes);
  }, [fromId, toId, routes]);

  useEffect(() => {
    onHighlight(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  return (
    <div className="glass-strong w-72 space-y-3 rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] uppercase tracking-wide text-accent">🧭 Itinéraire</p>
        <button
          onClick={() => {
            onHighlight(null);
            onClose();
          }}
          className="text-paper/50 hover:text-accent"
        >
          ✕
        </button>
      </div>

      <PlacePicker label="Départ" places={places} value={fromId} onChange={setFromId} />
      <PlacePicker label="Arrivée" places={places} value={toId} onChange={setToId} />

      {fromId && toId && (
        <div className="border-t border-white/10 pt-2 text-sm">
          {plan ? (
            <>
              <p className="text-accent">⏱ {plan.totalMinutes} min de trajet RP</p>
              <ol className="mt-1.5 space-y-1 text-xs text-paper/70">
                {plan.placeIds.map((pid, i) => {
                  const p = places.find((pl) => pl.id === pid);
                  return (
                    <li key={pid}>
                      {i + 1}. {p?.icon ?? '📍'} {p?.name ?? '?'}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <p className="text-paper/50">Aucun itinéraire trouvé entre ces deux lieux.</p>
          )}
        </div>
      )}
    </div>
  );
}
