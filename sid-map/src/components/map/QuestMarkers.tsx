'use client';

import type { MapPlace, MapQuest } from '@/lib/types';
import { SvgIcon } from "@/components/icons/SidIcon";

export default function QuestMarkers({
  quests,
  places,
  openId,
  onToggle
}: {
  quests: MapQuest[];
  places: MapPlace[];
  openId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      {quests.map((q) => {
        const place = places.find((p) => p.id === q.place_id);
        if (!place) return null;
        const offset = (place.shape === 'rect' ? (place.height ?? 6) / 2 : place.radius ?? 3) + 2.5;
        return (
          <g key={q.id} transform={`translate(${place.x - offset}, ${place.y - offset})`}>
            <g
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(q.id);
              }}
            >
              <circle r={openId === q.id ? 1.9 : 1.55} fill="#f2d98f" stroke="#2e261d" strokeWidth={0.2} />
              <SvgIcon name="scroll" size={2.1} />
            </g>
          </g>
        );
      })}
    </>
  );
}
