'use client';

import { useMemo } from 'react';
import { FLOOR_HEIGHT, WALL_HEIGHT, isoProject } from '@/lib/iso';
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

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

function pts(list: { x: number; y: number }[]) {
  return list.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

export default function Building3DView({ floors }: { floors: BuildingFloor[] }) {
  const sortedFloors = [...floors].sort((a, b) => a.floor_number - b.floor_number);

  const { boxes, viewBox, floorLabels } = useMemo(() => {
    const boxes: { top: string; s1: string; s2: string; color: string; key: string }[] = [];
    const floorLabels: { x: number; y: number; label: string }[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    function extend(p: { x: number; y: number }) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    sortedFloors.forEach((floor, floorIdx) => {
      const baseZ = floorIdx * FLOOR_HEIGHT;
      const topZ = baseZ + WALL_HEIGHT;
      const rooms: Room[] = floor.plan_data?.length
        ? floor.plan_data
        : [{ id: `empty-${floor.id}`, name: '', type: 'Autre', x: 20, y: 20, w: 60, h: 60 }];

      const sorted = [...rooms].sort((a, b) => a.x + a.y - (b.x + b.y));

      sorted.forEach((room) => {
        const corners = [
          { x: room.x, y: room.y },
          { x: room.x + room.w, y: room.y },
          { x: room.x + room.w, y: room.y + room.h },
          { x: room.x, y: room.y + room.h }
        ];
        const top = corners.map((c) => isoProject(c.x, c.y, topZ));
        const base = corners.map((c) => isoProject(c.x, c.y, baseZ));
        top.forEach(extend);
        base.forEach(extend);

        const color = ROOM_COLORS[room.type] ?? '#8a8a8a';
        const s1 = [top[0], top[1], base[1], base[0]];
        const s2 = [top[1], top[2], base[2], base[1]];

        boxes.push({
          top: pts(top),
          s1: pts(s1),
          s2: pts(s2),
          color,
          key: `${floor.id}-${room.id}`
        });
      });

      const labelAnchor = isoProject(-4, 50, topZ);
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

    const pad = 12;
    const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

    return { boxes, viewBox: vb, floorLabels };
  }, [sortedFloors]);

  return (
    <div className="glass overflow-hidden rounded-xl">
      <svg viewBox={viewBox} className="h-[520px] w-full">
        {boxes.map((b) => (
          <g key={b.key}>
            <polygon points={b.s2} fill={shade(b.color, 0.55)} stroke="#00000055" strokeWidth={0.3} />
            <polygon points={b.s1} fill={shade(b.color, 0.75)} stroke="#00000055" strokeWidth={0.3} />
            <polygon points={b.top} fill={shade(b.color, 1.05)} stroke="#00000055" strokeWidth={0.3} />
          </g>
        ))}
        {floorLabels.map((f, i) => (
          <text
            key={i}
            x={f.x}
            y={f.y}
            fontSize="3"
            fill="#e7e5db"
            className="select-none"
            style={{ paintOrder: 'stroke', stroke: '#12141b', strokeWidth: 0.6 }}
          >
            {f.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
