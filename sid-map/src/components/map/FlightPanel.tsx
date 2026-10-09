'use client';

import type { MapBiome, MapPlace, MountType } from '@/lib/types';
import { BIOME_LABELS } from '@/lib/types';
import { blockedBiome } from '@/lib/biomePath';
import { distanceKm, flightMinutes, formatDistance, type MapSettings } from '@/lib/mapScale';
import { formatMinutes } from '@/lib/travel';

// Confirmation d'un vol libre : distance, durée, portée, biomes.
export default function FlightPanel({
  from,
  to,
  mount,
  settings,
  biomes,
  busy,
  onConfirm,
  onCancel
}: {
  from: MapPlace;
  to: MapPlace;
  mount: MountType;
  settings: MapSettings;
  biomes: MapBiome[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const km = distanceKm(from, to, settings);
  const outOfRange = mount.flight_range_km != null && km > mount.flight_range_km;
  const blocked = outOfRange ? null : blockedBiome([{ x: from.x, y: from.y }, { x: to.x, y: to.y }], biomes, mount.allowed_biomes);
  const same = from.id === to.id;
  const ok = !outOfRange && !blocked && !same;

  return (
    <div className="glass-strong absolute bottom-20 left-1/2 z-30 w-72 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl p-3 text-xs text-paper md:bottom-6">
      <p className="text-[10px] uppercase tracking-wide text-paper/50">
        {mount.icon} {mount.name} · vol libre
      </p>
      <p className="mt-0.5 text-sm">
        {from.name} → <span className="text-accent">{to.name}</span>
      </p>
      {same ? (
        <p className="mt-1 text-accent">Tu es déjà ici.</p>
      ) : (
        <>
          <p className="mt-1 text-paper/70">
            Distance : {formatDistance(km, settings.unit_label)}
            {mount.flight_range_km ? ` (portée ${mount.flight_range_km} ${settings.unit_label})` : ''}
          </p>
          {outOfRange && <p className="text-accent">Hors de portée de cette monture.</p>}
          {blocked && <p className="text-accent">Traverse un biome interdit : {BIOME_LABELS[blocked] ?? blocked}.</p>}
          {ok && <p className="text-paper/70">Durée : {formatMinutes(flightMinutes(km, mount, settings))}</p>}
        </>
      )}
      <div className="mt-2.5 flex gap-1.5">
        <button
          disabled={!ok || busy}
          onClick={onConfirm}
          className="btn-accent flex-1 rounded-lg py-1.5 text-xs font-semibold text-paper disabled:opacity-40"
        >
          🕊️ Décoller
        </button>
        <button onClick={onCancel} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper/70 hover:text-accent">
          Annuler
        </button>
      </div>
    </div>
  );
}
