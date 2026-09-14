'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BuildingFloor, Point, Room } from '@/lib/types';
import RoomFormModal from './RoomFormModal';

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

export default function FloorView({
  floor,
  canEdit,
  onUpdated
}: {
  floor: BuildingFloor;
  canEdit: boolean;
  onUpdated: () => void;
}) {
  const supabase = createClient();
  const svgRef = useRef<SVGSVGElement>(null);

  const [drawing, setDrawing] = useState<{ start: Point; current: Point } | null>(null);
  const [pendingRect, setPendingRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );

  function toSvgPoint(e: { clientX: number; clientY: number }): Point {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.max(0, Math.min(100, p.x)), y: Math.max(0, Math.min(100, p.y)) };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!canEdit) return;
    const start = toSvgPoint(e);
    setDrawing({ start, current: start });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drawing) return;
    setDrawing((d) => (d ? { ...d, current: toSvgPoint(e) } : d));
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!canEdit || !drawing) return;
    const end = toSvgPoint(e);
    const x = Math.min(drawing.start.x, end.x);
    const y = Math.min(drawing.start.y, end.y);
    const w = Math.abs(end.x - drawing.start.x);
    const h = Math.abs(end.y - drawing.start.y);
    setDrawing(null);
    if (w > 2 && h > 2) setPendingRect({ x, y, w, h });
  }

  async function saveRoom(name: string, type: string) {
    if (!pendingRect) return;
    const newRoom: Room = {
      id: crypto.randomUUID(),
      name,
      type,
      x: pendingRect.x,
      y: pendingRect.y,
      w: pendingRect.w,
      h: pendingRect.h
    };
    const updatedPlan = [...(floor.plan_data ?? []), newRoom];
    await supabase.from('building_floors').update({ plan_data: updatedPlan }).eq('id', floor.id);
    setPendingRect(null);
    onUpdated();
  }

  async function deleteRoom(roomId: string) {
    const updatedPlan = (floor.plan_data ?? []).filter((r) => r.id !== roomId);
    await supabase.from('building_floors').update({ plan_data: updatedPlan }).eq('id', floor.id);
    onUpdated();
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-lg text-accent">{floor.name || `Étage ${floor.floor_number}`}</h3>
        {floor.description && <p className="text-sm text-paper/70">{floor.description}</p>}
      </div>

      {canEdit && (
        <p className="text-xs text-paper/50">Clique-glisse sur le plan pour dessiner une nouvelle pièce.</p>
      )}

      <div className="glass overflow-hidden rounded-xl">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          style={{ touchAction: 'none' }}
          className={`h-[420px] w-full ${canEdit ? 'cursor-crosshair' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <rect x="0" y="0" width="100" height="100" fill="#1c1712" />
          <g stroke="#ffffff10" strokeWidth={0.15}>
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={100} />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 10} x2={100} y2={i * 10} />
            ))}
          </g>

          {(floor.plan_data ?? []).map((room) => (
            <g key={room.id}>
              <rect
                x={room.x}
                y={room.y}
                width={room.w}
                height={room.h}
                fill={ROOM_COLORS[room.type] ?? '#8a8a8a'}
                fillOpacity={0.55}
                stroke="#f4ecd8"
                strokeWidth={0.25}
                rx={0.5}
              />
              <text x={room.x + room.w / 2} y={room.y + room.h / 2} textAnchor="middle" fontSize="2.2" fill="#f4ecd8">
                {room.name}
              </text>
              {canEdit && (
                <g
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteRoom(room.id);
                  }}
                >
                  <circle cx={room.x + room.w - 2} cy={room.y + 2} r={2.2} fill="#00000060" />
                  <text
                    x={room.x + room.w - 2}
                    y={room.y + 2.8}
                    textAnchor="middle"
                    fontSize="2.6"
                    fill="#ff8080"
                  >
                    ✕
                  </text>
                </g>
              )}
            </g>
          ))}

          {drawing && (
            <rect
              x={Math.min(drawing.start.x, drawing.current.x)}
              y={Math.min(drawing.start.y, drawing.current.y)}
              width={Math.abs(drawing.current.x - drawing.start.x)}
              height={Math.abs(drawing.current.y - drawing.start.y)}
              fill="#b3261e"
              fillOpacity={0.3}
              stroke="#b3261e"
              strokeWidth={0.25}
            />
          )}
        </svg>
      </div>

      {pendingRect && <RoomFormModal onClose={() => setPendingRect(null)} onSave={saveRoom} />}
    </div>
  );
}
