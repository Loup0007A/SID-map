'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import type { MapPlace, MapZone, Point } from '@/lib/types';
import { PLACE_LABELS } from '@/lib/types';
import DetailPanel from './DetailPanel';
import ZoneFormModal from './ZoneFormModal';
import PlaceFormModal from './PlaceFormModal';

const PLACE_ICONS: Record<string, string> = {
  ville: '🏰',
  merveille: '✨',
  foret: '🌲',
  desert: '🏜️',
  montagne: '⛰️',
  ruine: '🏛️',
  village: '🏘️',
  autre: '📍'
};

type DrawMode = null | 'zone' | 'place';

export default function WorldMap() {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');

  const [zones, setZones] = useState<MapZone[]>([]);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<{ kind: 'zone' | 'place'; entity: MapZone | MapPlace } | null>(
    null
  );

  const [editMode, setEditMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [pendingPlacePos, setPendingPlacePos] = useState<Point | null>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_world_map');
    if (!error && data) {
      setZones(data.zones ?? []);
      setPlaces(data.places ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toSvgPoint(e: React.MouseEvent): Point {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  }

  function handleMapClick(e: React.MouseEvent) {
    if (!editMode || !drawMode) return;
    const pt = toSvgPoint(e);

    if (drawMode === 'zone') {
      setTempPoints((p) => [...p, pt]);
    } else if (drawMode === 'place') {
      setPendingPlacePos(pt);
    }
  }

  function finishZoneDrawing() {
    if (tempPoints.length < 3) return;
    setShowZoneForm(true);
  }

  function cancelDrawing() {
    setDrawMode(null);
    setTempPoints([]);
    setPendingPlacePos(null);
    setShowZoneForm(false);
  }

  function pointsToSvg(points: Point[]) {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0c1a2e]">
      {/* Toolbar admin */}
      {canEdit && (
        <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2 rounded-lg border border-gold/30 bg-ink/90 p-2 backdrop-blur">
          <button
            onClick={() => {
              setEditMode((v) => !v);
              cancelDrawing();
            }}
            className={`rounded px-3 py-1.5 text-xs font-semibold ${
              editMode ? 'bg-gold text-ink' : 'border border-gold/40 text-gold'
            }`}
          >
            {editMode ? 'Mode édition : ON' : 'Mode édition'}
          </button>

          {editMode && (
            <>
              <button
                onClick={() => {
                  setDrawMode('zone');
                  setTempPoints([]);
                }}
                className={`rounded px-3 py-1.5 text-xs ${
                  drawMode === 'zone' ? 'bg-gold text-ink' : 'border border-parchment/30 text-parchment/80'
                }`}
              >
                ✏️ Tracer une zone
              </button>
              {drawMode === 'zone' && (
                <button
                  onClick={finishZoneDrawing}
                  disabled={tempPoints.length < 3}
                  className="rounded border border-parchment/30 px-3 py-1.5 text-xs text-parchment/80 disabled:opacity-40"
                >
                  Terminer ({tempPoints.length} pts)
                </button>
              )}
              <button
                onClick={() => setDrawMode('place')}
                className={`rounded px-3 py-1.5 text-xs ${
                  drawMode === 'place' ? 'bg-gold text-ink' : 'border border-parchment/30 text-parchment/80'
                }`}
              >
                📍 Ajouter un lieu
              </button>
              {drawMode && (
                <button
                  onClick={cancelDrawing}
                  className="rounded border border-red-400/40 px-3 py-1.5 text-xs text-red-300"
                >
                  Annuler
                </button>
              )}
            </>
          )}
        </div>
      )}

      {loading && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-parchment/60">
          Chargement de la carte…
        </p>
      )}

      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full cursor-crosshair"
        onClick={handleMapClick}
      >
        {/* fond océan */}
        <rect x="0" y="0" width="100" height="100" fill="#0c1a2e" />

        {zones.map((z) => (
          <polygon
            key={z.id}
            points={pointsToSvg(z.path_points)}
            fill={z.color}
            fillOpacity={0.75}
            stroke="#00000055"
            strokeWidth={0.15}
            className="cursor-pointer transition hover:brightness-110"
            onClick={(e) => {
              e.stopPropagation();
              if (!drawMode) setSelected({ kind: 'zone', entity: z });
            }}
          />
        ))}

        {/* tracé en cours */}
        {tempPoints.length > 0 && (
          <>
            <polyline
              points={pointsToSvg(tempPoints)}
              fill="none"
              stroke="#b08d57"
              strokeWidth={0.3}
              strokeDasharray="0.6"
            />
            {tempPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={0.5} fill="#b08d57" />
            ))}
          </>
        )}

        {places.map((p) => (
          <g
            key={p.id}
            transform={`translate(${p.x}, ${p.y})`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (!drawMode) setSelected({ kind: 'place', entity: p });
            }}
          >
            <circle r={1.4} fill="#151312" stroke="#b08d57" strokeWidth={0.15} />
            <text textAnchor="middle" dy="0.5" fontSize="1.6">
              {PLACE_ICONS[p.type] ?? '📍'}
            </text>
            <text
              textAnchor="middle"
              dy="3"
              fontSize="1.4"
              fill="#f4ecd8"
              className="select-none"
              style={{ paintOrder: 'stroke', stroke: '#0c1a2e', strokeWidth: 0.3 }}
            >
              {p.name}
            </text>
          </g>
        ))}
      </svg>

      {selected && (
        <DetailPanel
          entity={selected.entity}
          kind={selected.kind}
          onClose={() => setSelected(null)}
        />
      )}

      {showZoneForm && (
        <ZoneFormModal
          points={tempPoints}
          onClose={cancelDrawing}
          onSaved={() => {
            cancelDrawing();
            load();
          }}
        />
      )}

      {pendingPlacePos && (
        <PlaceFormModal
          position={pendingPlacePos}
          zones={zones}
          onClose={cancelDrawing}
          onSaved={() => {
            cancelDrawing();
            load();
          }}
        />
      )}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1 text-xs text-parchment/60">
        Clique sur une zone ou un lieu pour l'explorer
      </div>
    </div>
  );
}
