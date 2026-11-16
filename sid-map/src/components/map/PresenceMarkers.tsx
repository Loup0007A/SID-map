'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CharacterPosition, MapPlace, MapRoute } from '@/lib/types';
import { useNow } from '@/lib/hooks/useNow';
import { travelerScreenPosition } from '@/lib/travel';
import { SvgIcon } from "@/components/icons/SidIcon";
import { GlitchMarkerArt } from './Glitch';

type Spot = { x: number; y: number; n: number };

/**
 * Membres brouillés depuis L'Envers (Lot 80) : le serveur ne donne pas leur
 * lieu. Leur marqueur saute au hasard sur la carte, comme un bug.
 */
function useGlitchSpots(ids: string[], places: MapPlace[]) {
  const key = ids.join(',');
  const box = useMemo(() => {
    if (!places.length) return { x0: 10, x1: 90, y0: 10, y1: 90 };
    const xs = places.map((p) => p.x);
    const ys = places.map((p) => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }, [places]);
  const pick = (n: number): Spot => ({
    x: box.x0 + Math.random() * Math.max(1, box.x1 - box.x0),
    y: box.y0 + Math.random() * Math.max(1, box.y1 - box.y0),
    n
  });
  const [spots, setSpots] = useState<Record<string, Spot>>({});

  useEffect(() => {
    if (!key) return setSpots({});
    const list = key.split(',');
    setSpots(Object.fromEntries(list.map((id) => [id, pick(0)])));
    const timers = list.map((id) => {
      let t: ReturnType<typeof setTimeout>;
      const jump = () => {
        setSpots((s) => ({ ...s, [id]: pick((s[id]?.n ?? 0) + 1) }));
        t = setTimeout(jump, 2400 + Math.random() * 2600);
      };
      t = setTimeout(jump, 1200 + Math.random() * 2400);
      return () => clearTimeout(t);
    });
    return () => timers.forEach((stop) => stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, box]);

  return spots;
}

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
  const glitched = positions.filter((p) => p.glitched && p.user_id !== myUserId);
  const spots = useGlitchSpots(glitched.map((p) => p.user_id), places);
  const meGlitched = positions.some((p) => p.glitched && p.user_id === myUserId);
  const myPlaceId = meGlitched ? positions.find((p) => p.user_id === myUserId)?.place_id ?? null : null;

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
              {placeId === myPlaceId && <rect x={-2.4} y={-2.4} width={4.8} height={4.8} rx={0.5} className="glitch-self" />}
              <circle r={1.7} fill="#f6eedb" stroke="#1f5f8f" strokeWidth={0.28} />
              <SvgIcon name="profile" size={2.1} />
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
            <circle r={1.5} fill="#f6eedb" stroke="#9b3b28" strokeWidth={0.26} />
            <SvgIcon name={p.active_mount_id ? 'horse' : 'walker'} size={2} />
          </g>
        );
      })}

      {glitched.map((p) => {
        const s = spots[p.user_id];
        if (!s) return null;
        return (
          <g key={p.user_id} transform={`translate(${s.x}, ${s.y})`}>
            <g key={s.n} className="glitch-pop">
              <GlitchMarkerArt label={p.nickname ?? undefined} />
            </g>
          </g>
        );
      })}
    </>
  );
}
