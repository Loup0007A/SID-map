'use client';

import Icon from '@/components/ui/Icon';

import { useEffect, useMemo, useState } from 'react';
import type { MapPlace, MapRoute } from '@/lib/types';
import { findShortestPath, type RoutePlan } from '@/lib/pathfinding';
import { formatMinutes } from '@/lib/travel';
import { SidIcon, GlyphText } from '@/components/icons/SidIcon';

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
      <label className="text-[10px] uppercase tracking-wide text-paper/65">{label}</label>
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
              <Icon value={p.icon ?? '📍'} /> {p.name}
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
  onHighlight,
  myPlaceId = null,
  traveling = false,
  speedMultiplier = 1,
  mountName = null,
  onStart,
  initialToId = null,
  bare = false
}: {
  /** destination déjà choisie (bouton « Y aller ») */
  initialToId?: string | null;
  /** sans cadre ni titre : le contenu est posé dans une fenêtre */
  bare?: boolean;
  places: MapPlace[];
  routes: MapRoute[];
  onClose: () => void;
  onHighlight: (plan: RoutePlan | null) => void;
  /** lieu où se trouve mon personnage (départ par défaut) */
  myPlaceId?: string | null;
  traveling?: boolean;
  speedMultiplier?: number;
  mountName?: string | null;
  /** lance le trajet ; renvoie true s'il est parti */
  onStart?: (plan: RoutePlan) => Promise<boolean>;
}) {
  const [fromId, setFromId] = useState<string | null>(myPlaceId);
  const [toId, setToId] = useState<string | null>(initialToId);
  const [starting, setStarting] = useState(false);

  // Mon lieu arrive après l'ouverture (chargement) : on le prend comme départ.
  useEffect(() => {
    if (myPlaceId && !fromId) setFromId(myPlaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlaceId]);

  const plan = useMemo(() => {
    if (!fromId || !toId) return null;
    return findShortestPath(fromId, toId, routes);
  }, [fromId, toId, routes]);

  useEffect(() => {
    onHighlight(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const speed = speedMultiplier > 0 ? speedMultiplier : 1;
  const fromMe = !!myPlaceId && fromId === myPlaceId;
  const canStart = !!onStart && !!plan && plan.steps.length > 0 && fromMe && !traveling;

  async function start() {
    if (!plan || !onStart) return;
    setStarting(true);
    const ok = await onStart(plan);
    setStarting(false);
    if (ok) {
      onHighlight(null);
      onClose();
    }
  }

  return (
    <div className={bare ? 'space-y-3' : 'glass-strong w-72 space-y-3 rounded-2xl p-3'}>
      <div className={bare ? 'hidden' : 'flex items-center justify-between'}>
        <p className="font-display text-[10px] uppercase tracking-wide text-accent"><SidIcon name="compass" /> Itinéraire</p>
        <button
          onClick={() => {
            onHighlight(null);
            onClose();
          }}
          className="text-paper/65 hover:text-accent"
        >
          ✕
        </button>
      </div>

      <PlacePicker label="Départ" places={places} value={fromId} onChange={setFromId} />
      {myPlaceId && !fromMe && (
        <button onClick={() => setFromId(myPlaceId)} className="-mt-2 text-[11px] text-accent underline">
          Partir de ma position
        </button>
      )}
      <PlacePicker label="Arrivée" places={places} value={toId} onChange={setToId} />

      {fromId && toId && (
        <div className="border-t border-white/10 pt-2 text-sm">
          {plan ? (
            plan.steps.length === 0 ? (
              <p className="text-paper/65">Départ et arrivée sont le même lieu.</p>
            ) : (
              <>
                <p className="text-accent">
                  <SidIcon name="clock" /> {formatMinutes(plan.totalMinutes / speed)} de trajet {mountName && speed !== 1 ? `(${mountName})` : 'à pied'}
                </p>
                <ol className="mt-1.5 space-y-1 text-xs text-paper/70">
                  {plan.placeIds.map((pid, i) => {
                    const p = places.find((pl) => pl.id === pid);
                    return (
                      <li key={pid}>
                        {i + 1}. <Icon value={p?.icon ?? '📍'} /> {p?.name ?? '?'}
                      </li>
                    );
                  })}
                </ol>
                {onStart && (
                  <div className="mt-2.5">
                    <button
                      onClick={start}
                      disabled={!canStart || starting}
                      className="btn-accent w-full rounded-lg py-2 text-xs font-semibold text-paper disabled:opacity-40"
                    >
                      <GlyphText text={starting ? 'Départ…' : plan.steps.length > 1 ? `🚶 Partir (${plan.steps.length} étapes)` : '🚶 Partir'} />
                    </button>
                    {traveling ? (
                      <p className="mt-1 text-[11px] text-paper/65">Tu es déjà en route : attends d’être arrivé.</p>
                    ) : !myPlaceId ? (
                      <p className="mt-1 text-[11px] text-paper/65">Choisis d’abord où commence ton personnage (Ma position).</p>
                    ) : !fromMe ? (
                      <p className="mt-1 text-[11px] text-paper/65">Pour partir, le départ doit être ta position actuelle.</p>
                    ) : null}
                  </div>
                )}
              </>
            )
          ) : (
            <p className="text-paper/65">Aucun itinéraire trouvé entre ces deux lieux.</p>
          )}
        </div>
      )}
    </div>
  );
}
