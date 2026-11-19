'use client';

import { useNow } from '@/lib/hooks/useNow';
import { incursionPos, type Incursion } from '@/lib/hooks/useMapEvents';

/**
 * Créature en incursion (migration 0119) : son médaillon avance sur la carte,
 * avec la trace de son passage. Le cercle pointillé montre d'où on peut la
 * signaler quand sa fiche est ouverte.
 */
export default function IncursionLayer({
  incursion,
  showReach,
  onOpen,
}: {
  incursion: Incursion;
  showReach: boolean;
  onOpen: () => void;
}) {
  const now = useNow(1000);
  const pos = incursionPos(incursion, now);
  const r = 2.4;
  return (
    <g className="incursion-layer">
      <polyline
        points={pos.done.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#7a1f14"
        strokeOpacity={0.55}
        strokeWidth={0.35}
        strokeDasharray="0.2 0.9"
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
      {showReach && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={incursion.reach}
          fill="#7a1f14"
          fillOpacity={0.06}
          stroke="#7a1f14"
          strokeOpacity={0.6}
          strokeWidth={0.18}
          strokeDasharray="0.8 0.6"
          style={{ pointerEvents: 'none' }}
        />
      )}
      <g
        transform={`translate(${pos.x} ${pos.y})`}
        className="cursor-pointer"
        role="button"
        aria-label={`Créature en incursion : ${incursion.entry.title ?? 'inconnue'}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <circle r={r + 1.4} fill="none" stroke="#c0392b" strokeWidth={0.3} className="incursion-pulse" />
        <defs>
          <clipPath id="incursion-clip">
            <circle r={r} />
          </clipPath>
        </defs>
        <circle r={r + 0.35} fill="#7a1f14" />
        {incursion.entry.image_url ? (
          <image
            href={incursion.entry.image_url}
            x={-r}
            y={-r}
            width={r * 2}
            height={r * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#incursion-clip)"
          />
        ) : (
          <>
            <circle r={r} fill="#2a1410" />
            <text textAnchor="middle" dy={0.9} fontSize={2.4} fill="#f6eedb">
              !
            </text>
          </>
        )}
        <circle r={r} fill="none" stroke="#f6eedb" strokeWidth={0.18} />
      </g>
    </g>
  );
}
