'use client';

import { useState } from 'react';
import type { CharacterPosition, MapPlace, MapRoute } from '@/lib/types';
import { pointAtProgress } from '@/lib/routeGeometry';

export default function PresenceMarkers({
  positions,
  places,
  routes
}: {
  positions: CharacterPosition[];
  places: MapPlace[];
  routes: MapRoute[];
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const byPlace = new Map<string, CharacterPosition[]>();
  const travelers = positions.filter((p) => p.route_id && p.route_progress != null);

  positions
    .filter((p) => p.place_id && !p.route_id)
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
                setOpenGroup(openGroup === placeId ? null : placeId);
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
            {openGroup === placeId && (
              <foreignObject x={-40} y={3} width={80} height={Math.min(60, 14 * people.length + 8)}>
                <div className="glass-strong rounded-lg p-1.5 text-[7px] leading-tight text-paper">
                  {people.map((p) => (
                    <p key={p.user_id} className="truncate">
                      {p.nickname ?? 'Membre'}
                    </p>
                  ))}
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}

      {travelers.map((p) => {
        const route = routes.find((r) => r.id === p.route_id);
        if (!route || route.path_points.length === 0) return null;
        const pos = pointAtProgress(route.path_points, p.route_progress ?? 0);
        return (
          <g key={p.user_id} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle r={1.4} fill="#e7c34a" stroke="#0c1a2e" strokeWidth={0.2} />
            <text textAnchor="middle" dy="0.55" fontSize="1.5">
              🚶
            </text>
          </g>
        );
      })}
    </>
  );
}
