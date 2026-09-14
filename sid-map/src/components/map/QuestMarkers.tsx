'use client';

import { useState } from 'react';
import type { MapPlace, MapQuest } from '@/lib/types';

export default function QuestMarkers({ quests, places }: { quests: MapQuest[]; places: MapPlace[] }) {
  const [open, setOpen] = useState<string | null>(null);

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
                setOpen(open === q.id ? null : q.id);
              }}
            >
              <circle r={1.5} fill="#e7c34a" stroke="#151312" strokeWidth={0.2} />
              <text textAnchor="middle" dy="0.55" fontSize="1.6">
                📜
              </text>
            </g>
            {open === q.id && (
              <foreignObject x={-45} y={3} width={90} height={54}>
                <div className="glass-strong rounded-lg p-2 text-[7.5px] leading-tight text-paper">
                  <p className="font-semibold text-[#e7c34a]">{q.title}</p>
                  {q.contract_type && <p className="mt-0.5 text-paper/70">Contrat : {q.contract_type}</p>}
                  {q.reward && <p className="text-paper/70">Récompense : {q.reward}</p>}
                  <a
                    href="https://sid-quest.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-[#e7c34a] underline"
                  >
                    Voir sur le site principal →
                  </a>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </>
  );
}
