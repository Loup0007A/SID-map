'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BuildingFloor, Point, Room } from '@/lib/types';
import { ROOM_TYPES, clamp, floorLabel, roomType, snap, type Furniture } from '@/lib/rooms';
import RoomFormModal from './RoomFormModal';
import { SidIcon } from '@/components/icons/SidIcon';

const INK = 'rgb(var(--encre))';

/** Sols : un motif par matière, en coordonnées du plan (0-100). */
function FloorPatterns({ uid }: { uid: string }) {
  const p = (id: string) => `${uid}-${id}`;
  return (
    <defs>
      <pattern id={p('grid')} width={5} height={5} patternUnits="userSpaceOnUse">
        <path d="M5 0H0V5" fill="none" stroke="#2a1408" strokeOpacity={0.12} strokeWidth={0.08} />
      </pattern>
      <pattern id={p('parquet')} width={8} height={2.4} patternUnits="userSpaceOnUse">
        <rect width={8} height={2.4} fill="#c9965e" />
        <path d="M0 2.4H8M3 0V1.2M7 1.2V2.4" stroke="#7a5230" strokeOpacity={0.5} strokeWidth={0.12} />
        <path d="M0 0.6H8" stroke="#fff" strokeOpacity={0.12} strokeWidth={0.3} />
      </pattern>
      <pattern id={p('planches')} width={2.2} height={10} patternUnits="userSpaceOnUse">
        <rect width={2.2} height={10} fill="#a87447" />
        <path d="M2.2 0V10M0 6.5H2.2" stroke="#5a3a1f" strokeOpacity={0.55} strokeWidth={0.12} />
        <circle cx={1.1} cy={2.5} r={0.12} fill="#5a3a1f" fillOpacity={0.5} />
      </pattern>
      <pattern id={p('carreaux')} width={4} height={4} patternUnits="userSpaceOnUse">
        <rect width={4} height={4} fill="#efe4cc" />
        <rect width={2} height={2} fill="#c9b48b" />
        <rect x={2} y={2} width={2} height={2} fill="#c9b48b" />
      </pattern>
      <pattern id={p('dalles')} width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} fill="#d6c8ab" />
        <path d="M0 0H6M0 3H6M0 0V3M3 3V6" stroke="#8f7f66" strokeOpacity={0.7} strokeWidth={0.14} />
      </pattern>
      <pattern id={p('pierre')} width={5} height={5} patternUnits="userSpaceOnUse">
        <rect width={5} height={5} fill="#9e8c72" />
        <path d="M0.4 0.6l1.8 -0.2 0.5 1.6 -1.7 0.7zM3 0.5l1.6 0.4 -0.2 1.7 -1.6 -0.3zM1 2.9l1.9 0.1 0.2 1.6 -2 0.1zM3.4 2.9l1.3 0.4 -0.2 1.4 -1.4 -0.2z" fill="#b6a385" stroke="#5d4f3c" strokeWidth={0.1} />
      </pattern>
      <pattern id={p('terre')} width={4} height={4} patternUnits="userSpaceOnUse">
        <rect width={4} height={4} fill="#8b6a47" />
        <circle cx={0.8} cy={1} r={0.18} fill="#5e4329" />
        <circle cx={2.9} cy={2.6} r={0.22} fill="#5e4329" />
        <circle cx={1.7} cy={3.4} r={0.14} fill="#c19a6b" />
      </pattern>
      <pattern id={p('herbe')} width={4} height={4} patternUnits="userSpaceOnUse">
        <rect width={4} height={4} fill="#8daa5b" />
        <path d="M0.8 1.4l0.2 -0.8 0.2 0.8M2.6 3.2l0.2 -0.8 0.2 0.8M3.1 0.9l0.15 -0.6 0.15 0.6" stroke="#4f6e2c" strokeWidth={0.14} fill="none" />
      </pattern>
      <pattern id={p('tapis')} width={4} height={4} patternUnits="userSpaceOnUse">
        <rect width={4} height={4} fill="#a83c33" />
        <path d="M2 0.4L3.6 2L2 3.6L0.4 2Z" fill="none" stroke="#e7b35a" strokeWidth={0.2} />
        <circle cx={2} cy={2} r={0.35} fill="#e7b35a" />
      </pattern>
      <pattern id={p('platre')} width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} fill="#ece1c9" />
        <circle cx={1.5} cy={2} r={0.1} fill="#2a1408" fillOpacity={0.12} />
        <circle cx={4.4} cy={4.6} r={0.12} fill="#2a1408" fillOpacity={0.1} />
      </pattern>
    </defs>
  );
}

/** Mobilier dessiné dans une boîte de -10 à 10. */
function Furnish({ kind }: { kind: Furniture }) {
  const s = { stroke: '#2a1408', strokeWidth: 0.6, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'lit':
      return (
        <g {...s}>
          <rect x={-4.5} y={-7.5} width={9} height={15} rx={1} fill="#f4ecd8" />
          <rect x={-3.6} y={-6.6} width={7.2} height={2.8} rx={0.9} fill="#fffaf0" />
          <rect x={-4.5} y={-2.4} width={9} height={9.9} rx={1} fill="#5f7fa6" />
          <path d="M-4.5 0H4.5" fill="none" strokeOpacity={0.6} />
        </g>
      );
    case 'table':
      return (
        <g {...s}>
          {[[0, -7], [0, 7], [-7, 0], [7, 0]].map(([x, y]) => (
            <rect key={`${x}${y}`} x={x - 1.6} y={y - 1.6} width={3.2} height={3.2} rx={0.6} fill="#8f5d34" />
          ))}
          <circle r={4.6} fill="#c9965e" />
          <circle r={1.2} fill="#f2b33d" />
        </g>
      );
    case 'four':
      return (
        <g {...s}>
          <rect x={-8} y={-8} width={16} height={7} rx={1} fill="#7b6650" />
          <path d="M-4 -1V-4.5A4 4 0 0 1 4 -4.5V-1Z" fill="#2a1408" />
          <circle cx={-1.2} cy={-2.4} r={0.9} fill="#f28a2a" stroke="none" />
          <circle cx={1.3} cy={-2} r={0.8} fill="#f2b33d" stroke="none" />
          <rect x={-6} y={2.5} width={12} height={5} rx={0.6} fill="#c9965e" />
        </g>
      );
    case 'bancs':
      return (
        <g {...s}>
          {[-6, -1, 4].map((y) => (
            <rect key={y} x={-8.5} y={y} width={17} height={2.4} rx={0.5} fill="#8f5d34" />
          ))}
        </g>
      );
    case 'autel':
      return (
        <g {...s}>
          <rect x={-7} y={-3.5} width={14} height={7} rx={0.6} fill="#f4ecd8" />
          <rect x={-7} y={-0.8} width={14} height={1.6} fill="#c8a75a" strokeWidth={0} />
          {[-4.5, 4.5].map((x) => (
            <g key={x}>
              <rect x={x - 0.6} y={-7} width={1.2} height={3.4} fill="#fffaf0" />
              <circle cx={x} cy={-7.6} r={0.7} fill="#f2b33d" />
            </g>
          ))}
        </g>
      );
    case 'tonneaux':
      return (
        <g {...s}>
          {[[-4, -3], [4, -3], [0, 4]].map(([x, y]) => (
            <g key={`${x}${y}`}>
              <circle cx={x} cy={y} r={3.4} fill="#9a6a3c" />
              <circle cx={x} cy={y} r={2.2} fill="none" strokeWidth={0.4} />
              <circle cx={x} cy={y} r={0.5} fill="#2a1408" />
            </g>
          ))}
        </g>
      );
    case 'comptoir':
      return (
        <g {...s}>
          <path d="M-8 -7H8V-3H-4V7H-8Z" fill="#8f5d34" />
          <rect x={1} y={1} width={4} height={4} fill="#c9965e" />
          <path d="M1 1L5 5M5 1L1 5" fill="none" strokeWidth={0.35} />
          <circle cx={4} cy={-5} r={0.9} fill="#f2b33d" />
        </g>
      );
    case 'enclume':
      return (
        <g {...s}>
          <path d="M-7 -4H5C6 -4 8 -3 8 -2H2V1L4 4H-4L-2 1V-2H-7Z" fill="#5d5550" />
          <rect x={-8} y={4.5} width={5} height={3} rx={0.5} fill="#7b6650" />
          <circle cx={-5.5} cy={6} r={0.8} fill="#f28a2a" stroke="none" />
        </g>
      );
    case 'etageres':
      return (
        <g {...s}>
          {[-7, 3].map((y) => (
            <g key={y}>
              <rect x={-8.5} y={y} width={17} height={3.4} fill="#8f5d34" />
              {Array.from({ length: 8 }, (_, i) => (
                <rect key={i} x={-8 + i * 2.05} y={y + 0.5} width={1.5} height={2.4} fill={['#b0413a', '#2f6f8f', '#c8a75a', '#4f6e2c'][i % 4]} strokeWidth={0.2} />
              ))}
            </g>
          ))}
        </g>
      );
    case 'baignoire':
      return (
        <g {...s}>
          <rect x={-4.5} y={-7.5} width={9} height={15} rx={4} fill="#fffaf0" />
          <rect x={-3} y={-5.5} width={6} height={11} rx={3} fill="#7fc6d6" strokeWidth={0.3} />
        </g>
      );
    case 'caisses':
      return (
        <g {...s}>
          {[[-5, -5], [1, -5], [-2, 1]].map(([x, y]) => (
            <g key={`${x}${y}`}>
              <rect x={x} y={y} width={5} height={5} fill="#c9965e" />
              <path d={`M${x} ${y}L${x + 5} ${y + 5}M${x + 5} ${y}L${x} ${y + 5}`} fill="none" strokeWidth={0.35} />
            </g>
          ))}
        </g>
      );
    case 'coffre':
      return (
        <g {...s}>
          <rect x={-6} y={-4} width={12} height={8} rx={1} fill="#9a6a3c" />
          <rect x={-6} y={-1} width={12} height={1.8} fill="#f2b33d" />
          <rect x={-1.2} y={-1.6} width={2.4} height={3} fill="#f2b33d" />
          {[-6, 0, 6].map((x) => (
            <circle key={x} cx={x * 1.2} cy={7.5} r={0.9} fill="#f2b33d" strokeWidth={0.3} />
          ))}
        </g>
      );
    case 'arbre':
      return (
        <g {...s}>
          <circle cx={4.5} cy={4.5} r={2.6} fill="#9eb6c4" />
          <circle cx={4.5} cy={4.5} r={1.4} fill="#3e6f8f" strokeWidth={0.3} />
          <circle cx={-2} cy={-2} r={6.5} fill="#5f8a3a" />
          <circle cx={-3.6} cy={-3.4} r={2.6} fill="#79a34c" strokeWidth={0.3} />
          <circle cx={0.4} cy={-0.6} r={2} fill="#79a34c" strokeWidth={0.3} />
        </g>
      );
    default:
      return null;
  }
}

type Drag =
  | { mode: 'draw'; start: Point; cur: Point }
  | { mode: 'move'; id: string; start: Point; orig: Room; moved: boolean }
  | { mode: 'resize'; id: string; start: Point; orig: Room };

/**
 * Plan d'un étage (Lot 92) : feuille de vélin, murs d'encre, sols et
 * mobilier selon le type de pièce, escaliers vers les autres étages.
 * Édition : dessiner une pièce, la déplacer, l'agrandir, la renommer.
 */
export default function FloorPlan({
  floor,
  floors,
  canEdit,
  onUpdated,
  onNavigateFloor,
}: {
  floor: BuildingFloor;
  floors: BuildingFloor[];
  canEdit: boolean;
  onUpdated: () => void;
  onNavigateFloor?: (floorNumber: number) => void;
}) {
  const uid = useId().replace(/:/g, '');
  const pat = (id: string) => `url(#${uid}-${id})`;
  const svgRef = useRef<SVGSVGElement>(null);
  const [rooms, setRooms] = useState<Room[]>(floor.plan_data ?? []);
  const [tool, setTool] = useState<'select' | 'draw'>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRooms(floor.plan_data ?? []);
    setSelected(null);
  }, [floor.id, floor.plan_data]);

  const sel = rooms.find((r) => r.id === selected) ?? null;
  const env = useMemo(() => {
    if (rooms.length === 0) return null;
    const x0 = Math.min(...rooms.map((r) => r.x)) - 1.4;
    const y0 = Math.min(...rooms.map((r) => r.y)) - 1.4;
    const x1 = Math.max(...rooms.map((r) => r.x + r.w)) + 1.4;
    const y1 = Math.max(...rooms.map((r) => r.y + r.h)) + 1.4;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [rooms]);

  function toPt(e: { clientX: number; clientY: number }): Point {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const q = pt.matrixTransform(ctm.inverse());
    return { x: clamp(q.x, 0, 100), y: clamp(q.y, 0, 100) };
  }

  async function savePlan(next: Room[]) {
    setErr(null);
    setRooms(next);
    const { error } = await createClient().from('building_floors').update({ plan_data: next }).eq('id', floor.id);
    if (error) setErr(`Plan non enregistré : ${error.message}`);
    onUpdated();
  }

  function onDown(e: React.PointerEvent) {
    if (!canEdit) return;
    if (tool === 'draw') {
      const p = toPt(e);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDrag({ mode: 'draw', start: { x: snap(p.x), y: snap(p.y) }, cur: p });
    } else {
      setSelected(null);
    }
  }
  function onRoomDown(e: React.PointerEvent, r: Room) {
    if (canEdit && tool === 'draw') return; // on trace par-dessus
    e.stopPropagation();
    setSelected(r.id);
    if (!canEdit || tool !== 'select') return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDrag({ mode: 'move', id: r.id, start: toPt(e), orig: r, moved: false });
  }
  function onHandleDown(e: React.PointerEvent, r: Room) {
    e.stopPropagation();
    if (!canEdit) return;
    svgRef.current?.setPointerCapture?.(e.pointerId);
    setDrag({ mode: 'resize', id: r.id, start: toPt(e), orig: r });
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = toPt(e);
    if (drag.mode === 'draw') return setDrag({ ...drag, cur: p });
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    if (drag.mode === 'move') {
      const o = drag.orig;
      const x = clamp(snap(o.x + dx), 0, 100 - o.w);
      const y = clamp(snap(o.y + dy), 0, 100 - o.h);
      if (!drag.moved && Math.hypot(dx, dy) < 0.8) return;
      setDrag({ ...drag, moved: true });
      setRooms((rs) => rs.map((r) => (r.id === o.id ? { ...r, x, y } : r)));
    } else {
      const o = drag.orig;
      const w = clamp(snap(o.w + dx), 3, 100 - o.x);
      const h = clamp(snap(o.h + dy), 3, 100 - o.y);
      setRooms((rs) => rs.map((r) => (r.id === o.id ? { ...r, w, h } : r)));
    }
  }
  function onUp() {
    if (!drag) return;
    if (drag.mode === 'draw') {
      const x = snap(Math.min(drag.start.x, drag.cur.x));
      const y = snap(Math.min(drag.start.y, drag.cur.y));
      const w = snap(Math.abs(drag.cur.x - drag.start.x));
      const h = snap(Math.abs(drag.cur.y - drag.start.y));
      if (w >= 3 && h >= 3) setPending({ x, y, w, h });
    } else if (drag.mode === 'resize' || drag.moved) {
      void savePlan(rooms);
    }
    setDrag(null);
  }

  async function addRoom(name: string, type: string, connectsToFloor?: number) {
    if (!pending) return;
    const room: Room = {
      id: crypto.randomUUID(),
      name,
      type,
      ...pending,
      ...(type === 'Escalier' && connectsToFloor != null ? { connectsToFloor } : {}),
    };
    setPending(null);
    setTool('select');
    setSelected(room.id);
    await savePlan([...rooms, room]);
  }

  function patchRoom(id: string, patch: Partial<Room>) {
    const next = rooms.map((r) => (r.id === id ? { ...r, ...patch } : r));
    if (patch.type && patch.type !== 'Escalier') {
      for (const r of next) if (r.id === id) delete r.connectsToFloor;
    }
    void savePlan(next);
  }

  const preview =
    drag?.mode === 'draw'
      ? {
          x: snap(Math.min(drag.start.x, drag.cur.x)),
          y: snap(Math.min(drag.start.y, drag.cur.y)),
          w: snap(Math.abs(drag.cur.x - drag.start.x)),
          h: snap(Math.abs(drag.cur.y - drag.start.y)),
        }
      : null;
  const otherFloors = floors.filter((f) => f.floor_number !== floor.floor_number);

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Outils du plan">
          <div className="seg-group">
            <button aria-pressed={tool === 'select'} onClick={() => setTool('select')} className={`seg ${tool === 'select' ? 'is-on' : ''}`}>
              Choisir et déplacer
            </button>
            <button aria-pressed={tool === 'draw'} onClick={() => { setTool('draw'); setSelected(null); }} className={`seg ${tool === 'draw' ? 'is-on' : ''}`}>
              <SidIcon name="pen" /> Dessiner une pièce
            </button>
          </div>
          <span className="text-xs opacity-75">
            {tool === 'draw' ? 'Clique-glisse sur la feuille pour tracer la pièce.' : 'Glisse une pièce pour la déplacer, son coin pour l’agrandir.'}
          </span>
        </div>
      )}

      <div className="plan-sheet">
        <svg
          ref={svgRef}
          viewBox="-3 -3 106 106"
          role="img"
          aria-label={`Plan : ${floorLabel(floor.floor_number, floor.name)}`}
          style={{ touchAction: canEdit ? 'none' : 'manipulation' }}
          className={`block h-auto w-full ${canEdit && tool === 'draw' ? 'cursor-crosshair' : ''}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <FloorPatterns uid={uid} />
          <rect x={-3} y={-3} width={106} height={106} fill="#f6ecd6" />
          <rect x={0} y={0} width={100} height={100} fill={pat('grid')} />

          {env && (
            <>
              <rect x={env.x + 0.7} y={env.y + 1.1} width={env.w} height={env.h} rx={0.6} style={{ fill: INK }} />
              <rect x={env.x} y={env.y} width={env.w} height={env.h} rx={0.6} fill={pat('platre')} style={{ stroke: INK }} strokeWidth={1.4} />
            </>
          )}

          {rooms.map((r) => {
            const t = roomType(r.type);
            const isStairs = r.type === 'Escalier';
            const small = r.w < 9 || r.h < 8;
            const fs = Math.min(10, Math.min(r.w, r.h) * 0.62) / 10;
            const active = r.id === selected;
            return (
              <g key={r.id} className={canEdit && tool === 'select' ? 'cursor-move' : 'cursor-pointer'} onPointerDown={(e) => onRoomDown(e, r)}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={pat(t.floor)} />
                {isStairs && (
                  <g style={{ pointerEvents: 'none' }}>
                    {Array.from({ length: Math.max(3, Math.floor((r.w >= r.h ? r.w : r.h) / 1.6)) }, (_, i) => {
                      const along = r.w >= r.h;
                      const k = (i + 1) * 1.6;
                      return along ? (
                        <line key={i} x1={r.x + k} y1={r.y + 0.4} x2={r.x + k} y2={r.y + r.h - 0.4} stroke="#2a1408" strokeWidth={0.2} />
                      ) : (
                        <line key={i} x1={r.x + 0.4} y1={r.y + k} x2={r.x + r.w - 0.4} y2={r.y + k} stroke="#2a1408" strokeWidth={0.2} />
                      );
                    })}
                  </g>
                )}
                {!small && !isStairs && t.furniture && (
                  <g transform={`translate(${r.x + r.w / 2} ${r.y + r.h / 2 + 1}) scale(${fs})`} style={{ pointerEvents: 'none' }}>
                    <Furnish kind={t.furniture} />
                  </g>
                )}
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" style={{ stroke: INK }} strokeWidth={0.7} />
                {active && <rect className="sel-ring" x={r.x - 0.5} y={r.y - 0.5} width={r.w + 1} height={r.h + 1} fill="none" stroke="#1e9a9a" strokeWidth={0.5} strokeDasharray="1.2 0.8" />}
                <g style={{ pointerEvents: 'none' }}>
                  {small ? (
                    <text x={r.x + r.w / 2} y={r.y + r.h / 2 - (isStairs ? 1.2 : -0.8)} textAnchor="middle" fontSize={2.4} className="plan-label" fill="#2a1408">
                      {r.name}
                    </text>
                  ) : (
                    <>
                      <rect x={r.x + 0.8} y={r.y + 0.8} width={Math.min(r.w - 1.6, r.name.length * 1.55 + 2.4)} height={3.9} rx={0.5} fill="#fffaf0" style={{ stroke: INK }} strokeWidth={0.25} />
                      <text x={r.x + 2} y={r.y + 3.65} fontSize={2.6} className="plan-label" fill="#2a1408">
                        {r.name.length > (r.w - 3.4) / 1.55 ? `${r.name.slice(0, Math.max(3, Math.floor((r.w - 4.6) / 1.55)))}…` : r.name}
                      </text>
                    </>
                  )}
                  {isStairs && r.connectsToFloor != null && (
                    <g>
                      <circle cx={r.x + r.w / 2} cy={r.y + r.h / 2 + (small ? 2.6 : 1)} r={2.1} fill="#f2b33d" style={{ stroke: INK }} strokeWidth={0.3} />
                      <text x={r.x + r.w / 2} y={r.y + r.h / 2 + (small ? 3.5 : 1.9)} textAnchor="middle" fontSize={2.4} fill="#2a1408" fontWeight={700}>
                        {r.connectsToFloor > floor.floor_number ? '▲' : '▼'}
                      </text>
                    </g>
                  )}
                </g>
                {active && canEdit && (
                  <g onPointerDown={(e) => onHandleDown(e, r)} className="cursor-nwse-resize">
                    <rect x={r.x + r.w - 1.6} y={r.y + r.h - 1.6} width={3.2} height={3.2} rx={0.6} fill="#f2b33d" style={{ stroke: INK }} strokeWidth={0.35} />
                  </g>
                )}
              </g>
            );
          })}

          {preview && (
            <rect x={preview.x} y={preview.y} width={preview.w} height={preview.h} fill="#1e9a9a" fillOpacity={0.25} stroke="#0f6e6e" strokeWidth={0.4} strokeDasharray="1 0.6" />
          )}

          {rooms.length === 0 && !preview && (
            <text x={50} y={50} textAnchor="middle" fontSize={3} className="plan-label" fill="#2a1408" fillOpacity={0.55}>
              {canEdit ? 'Choisis « Dessiner une pièce » et trace-la ici.' : 'Cet étage n’a pas encore de plan.'}
            </text>
          )}
        </svg>
      </div>

      {err && <p className="text-sm text-[#c23a2b]">{err}</p>}

      {sel && (
        <div className="room-card">
          <span className="room-swatch" style={{ background: roomType(sel.type).tint }} aria-hidden />
          {canEdit ? (
            <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <label className="text-xs font-semibold">
                Nom
                <input
                  key={sel.id}
                  defaultValue={sel.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== sel.name && patchRoom(sel.id, { name: e.target.value.trim().slice(0, 60) })}
                  className="glass-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs font-semibold">
                Type
                <select value={sel.type} onChange={(e) => patchRoom(sel.id, { type: e.target.value })} className="glass-input mt-1 block w-full rounded-lg px-2.5 py-1.5 text-sm">
                  {ROOM_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.key}
                    </option>
                  ))}
                </select>
              </label>
              {sel.type === 'Escalier' ? (
                <label className="text-xs font-semibold">
                  Mène à
                  <select
                    value={sel.connectsToFloor ?? ''}
                    onChange={(e) => patchRoom(sel.id, { connectsToFloor: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="glass-input mt-1 block w-full rounded-lg px-2.5 py-1.5 text-sm"
                  >
                    <option value="">Nulle part</option>
                    {otherFloors.map((f) => (
                      <option key={f.id} value={f.floor_number}>
                        {floorLabel(f.floor_number, f.name)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span />
              )}
            </div>
          ) : (
            <div className="flex-1">
              <p className="font-semibold">{sel.name}</p>
              <p className="text-xs opacity-75">{sel.type}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {sel.type === 'Escalier' && sel.connectsToFloor != null && floors.some((f) => f.floor_number === sel.connectsToFloor) && (
              <button onClick={() => onNavigateFloor?.(sel.connectsToFloor!)} className="btn-accent rounded-lg px-3 py-1.5 text-sm">
                {sel.connectsToFloor > floor.floor_number ? 'Monter' : 'Descendre'}
              </button>
            )}
            {canEdit && (
              <button onClick={() => { setSelected(null); void savePlan(rooms.filter((r) => r.id !== sel.id)); }} className="btn-danger rounded-lg px-3 py-1.5 text-sm">
                <SidIcon name="trash" /> Supprimer
              </button>
            )}
          </div>
        </div>
      )}

      {pending && (
        <RoomFormModal
          onClose={() => setPending(null)}
          onSave={addRoom}
          currentFloorNumber={floor.floor_number}
          floors={floors}
        />
      )}
    </div>
  );
}
