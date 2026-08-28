'use client';

import { useMemo } from 'react';
import { FLOOR_STEP, SLAB_THICKNESS, WALL_HEIGHT, isoProject } from '@/lib/iso';
import type { BuildingFloor, Room } from '@/lib/types';

const ROOM_COLORS: Record<string, string> = {
  Chambre: '#7c9cbf',
  Salon: '#c98a5b',
  Cuisine: '#8fae6b',
  Salle: '#b08d57',
  Couloir: '#6b6459',
  Escalier: '#a0522d',
  Autel: '#d4af37',
  Cave: '#3f3a34',
  Autre: '#8a8a8a'
};

function pts(list: { x: number; y: number }[]) {
  return list.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

// Envelope du bâtiment : le socle 0-100 / 0-100 représente le plan de
// chaque étage (murs extérieurs), quels que soient les contours des
// pièces qu'il contient.
const ENVELOPE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 }
];

function subdivideQuad(
  p00: { x: number; y: number },
  p10: { x: number; y: number },
  p11: { x: number; y: number },
  p01: { x: number; y: number },
  cols: number,
  rows: number
) {
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  });
  const at = (u: number, v: number) => lerp(lerp(p00, p10, u), lerp(p01, p11, u), v);

  const cells: { x: number; y: number }[][] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      cells.push([
        at(i / cols, j / rows),
        at((i + 1) / cols, j / rows),
        at((i + 1) / cols, (j + 1) / rows),
        at(i / cols, (j + 1) / rows)
      ]);
    }
  }
  return cells;
}

export default function Building3DView({ floors }: { floors: BuildingFloor[] }) {
  const sortedFloors = [...floors].sort((a, b) => a.floor_number - b.floor_number);

  const { slabFaces, glassCells, roomFootprints, floorLabels, viewBox } = useMemo(() => {
    const slabFaces: { poly: string; shade: number }[] = [];
    const glassCells: { poly: string }[] = [];
    const roomFootprints: { poly: string; color: string; labelX: number; labelY: number; label: string }[] = [];
    const floorLabels: { x: number; y: number; label: string }[] = [];

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const extend = (p: { x: number; y: number }) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    };

    sortedFloors.forEach((floor, i) => {
      const slabBase = i * FLOOR_STEP;
      const slabTop = slabBase + SLAB_THICKNESS;
      const wallTop = slabTop + WALL_HEIGHT;

      const [A, B, C, D] = ENVELOPE;

      // --- Dalle de plancher (opaque, façon maquette blanche) ---
      const slabTopFace = ENVELOPE.map((c) => isoProject(c.x, c.y, slabTop));
      const slabFrontFace = [
        isoProject(A.x, A.y, slabTop),
        isoProject(B.x, B.y, slabTop),
        isoProject(B.x, B.y, slabBase),
        isoProject(A.x, A.y, slabBase)
      ];
      const slabRightFace = [
        isoProject(B.x, B.y, slabTop),
        isoProject(C.x, C.y, slabTop),
        isoProject(C.x, C.y, slabBase),
        isoProject(B.x, B.y, slabBase)
      ];
      [slabTopFace, slabFrontFace, slabRightFace].forEach((f) => f.forEach(extend));
      slabFaces.push({ poly: pts(slabRightFace), shade: 0.72 });
      slabFaces.push({ poly: pts(slabFrontFace), shade: 0.85 });
      slabFaces.push({ poly: pts(slabTopFace), shade: 1 });

      // --- Façade vitrée en grille (deux faces visibles) ---
      const cols = 10;
      const rows = 3;
      const frontTop = [isoProject(A.x, A.y, wallTop), isoProject(B.x, B.y, wallTop)];
      const frontBase = [isoProject(A.x, A.y, slabTop), isoProject(B.x, B.y, slabTop)];
      const rightTop = [isoProject(B.x, B.y, wallTop), isoProject(C.x, C.y, wallTop)];
      const rightBase = [isoProject(B.x, B.y, slabTop), isoProject(C.x, C.y, slabTop)];

      subdivideQuad(frontTop[0], frontTop[1], frontBase[1], frontBase[0], cols, rows).forEach((cell) => {
        cell.forEach(extend);
        glassCells.push({ poly: pts(cell) });
      });
      subdivideQuad(rightTop[0], rightTop[1], rightBase[1], rightBase[0], cols, rows).forEach((cell) => {
        cell.forEach(extend);
        glassCells.push({ poly: pts(cell) });
      });

      // --- Pièces visibles à l'intérieur (empreintes plates, pas de murs opaques) ---
      const rooms: Room[] = floor.plan_data ?? [];
      const sortedRooms = [...rooms].sort((a, b) => a.x + a.y - (b.x + b.y));
      sortedRooms.forEach((room) => {
        const corners = [
          { x: room.x, y: room.y },
          { x: room.x + room.w, y: room.y },
          { x: room.x + room.w, y: room.y + room.h },
          { x: room.x, y: room.y + room.h }
        ];
        const projected = corners.map((c) => isoProject(c.x, c.y, wallTop + 0.15));
        projected.forEach(extend);
        const center = isoProject(room.x + room.w / 2, room.y + room.h / 2, wallTop + 0.2);
        roomFootprints.push({
          poly: pts(projected),
          color: ROOM_COLORS[room.type] ?? '#8a8a8a',
          labelX: center.x,
          labelY: center.y,
          label: room.name
        });
      });

      const labelAnchor = isoProject(-6, 50, (slabTop + wallTop) / 2);
      extend(labelAnchor);
      floorLabels.push({
        x: labelAnchor.x,
        y: labelAnchor.y,
        label: floor.name || `Étage ${floor.floor_number}`
      });
    });

    if (!isFinite(minX)) {
      minX = -10;
      minY = -10;
      maxX = 10;
      maxY = 10;
    }
    const pad = 14;
    const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

    return { slabFaces, glassCells, roomFootprints, floorLabels, viewBox: vb };
  }, [sortedFloors]);

  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-[#f3f3f1]">
      <svg viewBox={viewBox} className="h-[560px] w-full">
        {slabFaces.map((f, i) => (
          <polygon
            key={`slab-${i}`}
            points={f.poly}
            style={{ fill: `hsl(0,0%,${f.shade * 100}%)` }}
            stroke="#00000022"
            strokeWidth={0.25}
          />
        ))}

        {roomFootprints.map((r, i) => (
          <polygon key={`room-${i}`} points={r.poly} fill={r.color} fillOpacity={0.35} stroke="#00000030" strokeWidth={0.2} />
        ))}
        {roomFootprints.map((r, i) =>
          r.label ? (
            <text key={`label-${i}`} x={r.labelX} y={r.labelY} textAnchor="middle" fontSize="2.4" fill="#2a2a28">
              {r.label}
            </text>
          ) : null
        )}

        {glassCells.map((c, i) => (
          <polygon key={`glass-${i}`} points={c.poly} fill="#ffffff" fillOpacity={0.08} stroke="#00000035" strokeWidth={0.18} />
        ))}

        {floorLabels.map((f, i) => (
          <text key={`fl-${i}`} x={f.x} y={f.y} fontSize="3.2" fill="#3a3a38" className="select-none">
            {f.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
