'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import type { CityBuilding, CityDistrict, MapPlace, Point } from '@/lib/types';
import DistrictFormModal from './DistrictFormModal';
import BuildingFormModal from './BuildingFormModal';
import BuildingDetailPanel from './BuildingDetailPanel';

const BUILDING_ICONS: Record<string, string> = {
  maison: '🏠',
  cathedrale: '⛪',
  auberge: '🍺',
  commerce: '🏪',
  autre: '🏗️'
};

type DrawMode = null | 'district' | 'building';

export default function CityMap({ cityId }: { cityId: string }) {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');

  const [city, setCity] = useState<MapPlace | null>(null);
  const [districts, setDistricts] = useState<CityDistrict[]>([]);
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuilding | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [pendingBuildingPos, setPendingBuildingPos] = useState<Point | null>(null);
  const [showDistrictForm, setShowDistrictForm] = useState(false);
  const [activeDistrictFilter, setActiveDistrictFilter] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('get_city_plan', { p_city_id: cityId });
    if (data) {
      setCity(data.city ?? null);
      setDistricts(data.districts ?? []);
      setBuildings(data.buildings ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  function toSvgPoint(e: React.MouseEvent): Point {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 100,
      y: Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 100
    };
  }

  function handleClick(e: React.MouseEvent) {
    if (!editMode || !drawMode) return;
    const pt = toSvgPoint(e);
    if (drawMode === 'district') setTempPoints((p) => [...p, pt]);
    else setPendingBuildingPos(pt);
  }

  function cancelDrawing() {
    setDrawMode(null);
    setTempPoints([]);
    setPendingBuildingPos(null);
    setShowDistrictForm(false);
  }

  const pointsToSvg = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const visibleBuildings = activeDistrictFilter
    ? buildings.filter((b) => b.district_id === activeDistrictFilter)
    : buildings;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#2a2419]">
      <Link
        href="/carte"
        className="absolute left-4 top-4 z-20 rounded bg-ink/80 px-3 py-1.5 text-xs text-gold hover:brightness-110"
      >
        ← Retour à la carte du monde
      </Link>

      <div className="absolute left-4 top-14 z-20 rounded bg-ink/80 px-3 py-1.5 font-display text-sm text-parchment">
        {city?.name}
      </div>

      {canEdit && (
        <div className="absolute left-4 top-24 z-20 flex flex-wrap gap-2 rounded-lg border border-gold/30 bg-ink/90 p-2 backdrop-blur">
          <button
            onClick={() => {
              setEditMode((v) => !v);
              cancelDrawing();
            }}
            className={`rounded px-3 py-1.5 text-xs font-semibold ${
              editMode ? 'bg-gold text-ink' : 'border border-gold/40 text-gold'
            }`}
          >
            {editMode ? 'Édition : ON' : 'Mode édition'}
          </button>
          {editMode && (
            <>
              <button
                onClick={() => {
                  setDrawMode('district');
                  setTempPoints([]);
                }}
                className={`rounded px-3 py-1.5 text-xs ${
                  drawMode === 'district' ? 'bg-gold text-ink' : 'border border-parchment/30 text-parchment/80'
                }`}
              >
                ✏️ Tracer un quartier
              </button>
              {drawMode === 'district' && (
                <button
                  onClick={() => tempPoints.length >= 3 && setShowDistrictForm(true)}
                  disabled={tempPoints.length < 3}
                  className="rounded border border-parchment/30 px-3 py-1.5 text-xs text-parchment/80 disabled:opacity-40"
                >
                  Terminer ({tempPoints.length})
                </button>
              )}
              <button
                onClick={() => setDrawMode('building')}
                className={`rounded px-3 py-1.5 text-xs ${
                  drawMode === 'building' ? 'bg-gold text-ink' : 'border border-parchment/30 text-parchment/80'
                }`}
              >
                🏠 Ajouter un bâtiment
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

      {districts.length > 0 && (
        <div className="absolute right-4 top-4 z-20 flex flex-col gap-1 rounded-lg border border-gold/30 bg-ink/90 p-2 text-xs">
          <button
            onClick={() => setActiveDistrictFilter(null)}
            className={!activeDistrictFilter ? 'text-gold' : 'text-parchment/70 hover:text-gold'}
          >
            Tous les quartiers
          </button>
          {districts.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDistrictFilter(d.id)}
              className={activeDistrictFilter === d.id ? 'text-gold' : 'text-parchment/70 hover:text-gold'}
              style={{ borderLeft: `3px solid ${d.color}`, paddingLeft: 6 }}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-parchment/60">
          Chargement du plan…
        </p>
      )}

      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full cursor-crosshair"
        onClick={handleClick}
      >
        <rect x="0" y="0" width="100" height="100" fill="#2a2419" />

        {districts.map((d) => (
          <polygon
            key={d.id}
            points={pointsToSvg(d.path_points)}
            fill={d.color}
            fillOpacity={activeDistrictFilter && activeDistrictFilter !== d.id ? 0.1 : 0.35}
            stroke="#00000055"
            strokeWidth={0.15}
          />
        ))}

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

        {visibleBuildings.map((b) => (
          <g
            key={b.id}
            transform={`translate(${b.x}, ${b.y}) rotate(${b.rotation})`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (!drawMode) setSelectedBuilding(b);
            }}
          >
            <rect
              x={-b.width / 2}
              y={-b.height / 2}
              width={b.width}
              height={b.height}
              fill="#151312"
              stroke="#b08d57"
              strokeWidth={0.1}
              rx={0.3}
            />
            <text textAnchor="middle" dy="0.6" fontSize="1.8">
              {BUILDING_ICONS[b.type] ?? '🏗️'}
            </text>
          </g>
        ))}
      </svg>

      {selectedBuilding && (
        <BuildingDetailPanel building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      )}

      {showDistrictForm && (
        <DistrictFormModal
          cityId={cityId}
          points={tempPoints}
          onClose={cancelDrawing}
          onSaved={() => {
            cancelDrawing();
            load();
          }}
        />
      )}

      {pendingBuildingPos && (
        <BuildingFormModal
          cityId={cityId}
          districtId={activeDistrictFilter}
          position={pendingBuildingPos}
          onClose={cancelDrawing}
          onSaved={() => {
            cancelDrawing();
            load();
          }}
        />
      )}
    </div>
  );
}
