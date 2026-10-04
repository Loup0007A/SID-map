'use client';

import type { CharacterPosition, MapPlace, MapRoute } from '@/lib/types';
import { useNow } from '@/lib/hooks/useNow';
import { travelerScreenPosition } from '@/lib/travel';

export default function PresenceMarkers({
  positions,
  places,
  routes,
  openGroup,
  onToggle
}: {
  positions: CharacterPosition[];
  places: MapPlace[];
  routes: MapRoute[];
  openGroup: string | null;
  onToggle: (placeId: string) => void;
}) {
  const now = useNow();

  const byPlace = new Map<string, CharacterPosition[]>();
  const travelers = positions.filter((p) => p.travel_started_at);

  positions
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
              <circle r={1.6} fill="#1e9e5a" stroke="#0c1a2e" strokeWidth={0.2} />
              <text textAnchor="middle" dy="0.6" fontSize="1.6">
                👤
              </text>
              {people.length > 1 && (
                <>
                  <circle cx={1.3} cy={-1.3} r={1} fill="#b3261e" />
                  <text x={1.3} y={-1.3} dy="0.4" textAnchor="middle" fontSize="1.1" fill="#fff">
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
            <circle r={1.4} fill="#e7c34a" stroke="#0c1a2e" strokeWidth={0.2} />
            <text textAnchor="middle" dy="0.55" fontSize="1.5">
              {p.active_mount_id ? '🐎' : '🚶'}
            </text>
          </g>
        );
      })}
    </>
  );
}
