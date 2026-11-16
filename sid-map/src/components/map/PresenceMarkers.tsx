'use client';

import type { CharacterPosition, MapPlace, MapRoute } from '@/lib/types';
import { useNow } from '@/lib/hooks/useNow';
import { travelerScreenPosition } from '@/lib/travel';
import { SvgIcon } from "@/components/icons/SidIcon";

export default function PresenceMarkers({
  positions,
  places,
  routes,
  openGroup,
  onToggle,
  myUserId = null
}: {
  positions: CharacterPosition[];
  places: MapPlace[];
  routes: MapRoute[];
  openGroup: string | null;
  onToggle: (placeId: string) => void;
  myUserId?: string | null;
}) {
  const now = useNow();
  // Lieu inconnu (L'Envers) : un membre brouillé n'a plus de marqueur pour
  // les autres. Lui garde le sien, en fantôme, pour savoir où il est.
  const shown = positions.filter((p) => !p.glitched || p.user_id === myUserId);
  const me = shown.find((p) => p.glitched && p.user_id === myUserId);
  const ghostPlaceId = me && !me.travel_started_at ? me.place_id : null;

  const byPlace = new Map<string, CharacterPosition[]>();
  const travelers = shown.filter((p) => p.travel_started_at);

  shown
    .filter((p) => p.place_id && !p.travel_started_at)
    .forEach((p) => {
      const list = byPlace.get(p.place_id!) ?? [];
      list.push(p);
      byPlace.set(p.place_id!, list);
    });

  return (
    <>
      {Array.from(byPlace.entries()).map(([placeId, people]) => {
        const place = places.find((p) => p.id === placeId);
        if (!place) return null;
        const offsetY = (place.shape === 'rect' ? (place.height ?? 6) / 2 : place.radius ?? 3) + 5;

        return (
          <g key={placeId} transform={`translate(${place.x}, ${place.y + offsetY})`}>
            <g
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(placeId);
              }}
            >
              {placeId === ghostPlaceId && <rect x={-2.4} y={-2.4} width={4.8} height={4.8} rx={0.5} className="glitch-self" />}
              <g className={placeId === ghostPlaceId && people.length === 1 ? 'glitch-ghost' : undefined}>
                <circle r={1.7} fill="#f6eedb" stroke="#1f5f8f" strokeWidth={0.28} />
                <SvgIcon name="profile" size={2.1} />
              </g>
              {people.length > 1 && (
                <>
                  <circle cx={1.4} cy={-1.4} r={1} fill="#9b3b28" stroke="#f6eedb" strokeWidth={0.15} />
                  <text x={1.4} y={-1.4} dy="0.4" textAnchor="middle" fontSize="1.1" fill="#fff">
                    {people.length}
                  </text>
                </>
              )}
            </g>
          </g>
        );
      })}

      {travelers.map((p) => {
        const pos = travelerScreenPosition(p, places, routes, now);
        if (!pos) return null;
        return (
          <g key={p.user_id} transform={`translate(${pos.x}, ${pos.y})`}>
            {p === me && <rect x={-2.2} y={-2.2} width={4.4} height={4.4} rx={0.5} className="glitch-self" />}
            <g className={p === me ? 'glitch-ghost' : undefined}>
              <circle r={1.5} fill="#f6eedb" stroke="#9b3b28" strokeWidth={0.26} />
              <SvgIcon name={p.active_mount_id ? 'horse' : 'walker'} size={2} />
            </g>
          </g>
        );
      })}
    </>
  );
}
