'use client';

import type { MapPlace, MapQuest } from '@/lib/types';
import { SvgIcon } from "@/components/icons/SidIcon";

/**
 * Un parchemin par lieu qui a des quêtes ouvertes (Lot 59). Plusieurs
 * quêtes au même endroit : un seul marqueur avec leur nombre, au lieu de
 * parchemins empilés les uns sur les autres. Un halo doré respire autour.
 */
export default function QuestMarkers({
  quests,
  places,
  openPlaceId,
  onToggle
}: {
  quests: MapQuest[];
  places: MapPlace[];
  openPlaceId: string | null;
  onToggle: (placeId: string) => void;
}) {
  const byPlace = new Map<string, MapQuest[]>();
  for (const q of quests) byPlace.set(q.place_id, [...(byPlace.get(q.place_id) ?? []), q]);

  return (
    <>
      {[...byPlace.entries()].map(([placeId, list]) => {
        const place = places.find((p) => p.id === placeId);
        if (!place) return null;
        const offset = (place.shape === 'rect' ? (place.height ?? 6) / 2 : place.radius ?? 3) + 2.5;
        const open = openPlaceId === placeId;
        return (
          <g key={placeId} transform={`translate(${place.x - offset}, ${place.y - offset})`}>
            <g
              className="quest-marker cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${list.length} quête${list.length > 1 ? 's' : ''} à ${place.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(placeId);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle(placeId);
                }
              }}
            >
              <circle className="quest-halo" r={2.4} />
              <circle r={open ? 1.9 : 1.55} fill="#f2d98f" stroke="#2e261d" strokeWidth={0.2} />
              <SvgIcon name="scroll" size={2.1} />
              {list.length > 1 && (
                <g transform="translate(1.45, -1.35)">
                  <circle r={0.95} fill="#b8432c" stroke="#f2d98f" strokeWidth={0.18} />
                  <text textAnchor="middle" dy="0.42" fontSize="1.2" fontWeight={700} fill="#fff4dc" style={{ pointerEvents: 'none' }}>
                    {list.length > 9 ? '9+' : list.length}
                  </text>
                </g>
              )}
            </g>
          </g>
        );
      })}
    </>
  );
}
