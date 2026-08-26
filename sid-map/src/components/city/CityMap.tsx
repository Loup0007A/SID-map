'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import { useSvgViewport } from '@/lib/hooks/useSvgViewport';
import type { CityBuilding, CityDistrict, MapPlace, Point } from '@/lib/types';
import type { ShapeTool } from '@/lib/drawTools';
import { DRAG_SHAPES } from '@/lib/drawTools';
import { circleFromBox, ellipseFromBox, simplifyFreehand, squareFromBox, trapezoidFromBox } from '@/lib/shapes';
import DistrictFormModal from './DistrictFormModal';
import BuildingFormModal from './BuildingFormModal';
import BuildingDetailPanel from './BuildingDetailPanel';
import ShapeToolbar from '@/components/map/ShapeToolbar';
import ZoomControls from '@/components/map/ZoomControls';
import GridOverlay from '@/components/map/GridOverlay';

const BUILDING_ICONS: Record<string, string> = {
  maison: '⌂',
  cathedrale: '✚',
  auberge: '☗',
  commerce: '$',
  autre: '■'
};

const CLOSE_SNAP_PX = 14;

export default function CityMap({ cityId }: { cityId: string }) {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');
  const vp = useSvgViewport();

  const [city, setCity] = useState<MapPlace | null>(null);
  const [districts, setDistricts] = useState<CityDistrict[]>([]);
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuilding | null>(null);
  const [activeDistrictFilter, setActiveDistrictFilter] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [activeTool, setActiveTool] = useState<ShapeTool | 'point' | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [dragBox, setDragBox] = useState<{ start: Point; end: Point } | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [finalPoints, setFinalPoints] = useState<Point[] | null>(null);
  const [pendingBuildingPos, setPendingBuildingPos] = useState<Point | null>(null);

  const downRef = useRef<null | { x: number; y: number }>(null);

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

  function resetDrawing() {
    setActiveTool(null);
    setTempPoints([]);
    setDragBox(null);
    setFreehandPoints([]);
    setFinalPoints(null);
    setPendingBuildingPos(null);
  }

  function selectTool(t: ShapeTool) {
    setActiveTool(t);
    setTempPoints([]);
    setDragBox(null);
    setFreehandPoints([]);
  }

  function handleMouseDown(e: React.MouseEvent) {
    downRef.current = { x: e.clientX, y: e.clientY };
    if (e.button !== 0) return;
    if (!editMode || activeTool === null) {
      vp.startPan(e.clientX, e.clientY);
      return;
    }
    if (DRAG_SHAPES.includes(activeTool as ShapeTool)) {
      const pt = vp.screenToSvg(e.clientX, e.clientY);
      if (activeTool === 'freehand') setFreehandPoints([pt]);
      else setDragBox({ start: pt, end: pt });
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (vp.isPanning) {
      vp.doPan(e.clientX, e.clientY);
      return;
    }
    if (!editMode || !activeTool) return;
    if (activeTool === 'freehand' && freehandPoints.length > 0) {
      const pt = vp.screenToSvg(e.clientX, e.clientY);
      setFreehandPoints((pts) => {
        const last = pts[pts.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < 0.5) return pts;
        return [...pts, pt];
      });
    } else if (dragBox) {
      const pt = vp.screenToSvg(e.clientX, e.clientY);
      setDragBox((b) => (b ? { ...b, end: pt } : b));
    }
  }

  function finalizeDragShape() {
    if (activeTool === 'freehand') {
      const simplified = simplifyFreehand(freehandPoints);
      if (simplified.length >= 3) setFinalPoints(simplified);
      else resetDrawing();
      setFreehandPoints([]);
      return;
    }
    if (dragBox) {
      const { start, end } = dragBox;
      let pts: Point[] = [];
      if (activeTool === 'circle') pts = circleFromBox(start.x, start.y, end.x, end.y);
      else if (activeTool === 'ellipse') pts = ellipseFromBox(start.x, start.y, end.x, end.y);
      else if (activeTool === 'square') pts = squareFromBox(start.x, start.y, end.x, end.y);
      else if (activeTool === 'trapezoid') pts = trapezoidFromBox(start.x, start.y, end.x, end.y);
      setDragBox(null);
      if (pts.length >= 3) setFinalPoints(pts);
      else resetDrawing();
    }
  }

  function svgDistToScreenPx(a: Point, b: Point) {
    const svg = vp.svgRef.current;
    if (!svg) return Infinity;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / vp.viewBox.w;
    return Math.hypot(a.x - b.x, a.y - b.y) * scale;
  }

  function handleMouseUp(e: React.MouseEvent) {
    const start = downRef.current;
    downRef.current = null;
    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 0;

    if (vp.isPanning) {
      vp.endPan();
      return;
    }
    if (!editMode || !activeTool) return;

    if (activeTool === 'freehand' || DRAG_SHAPES.includes(activeTool as ShapeTool)) {
      if (moved >= 3) finalizeDragShape();
      else {
        setDragBox(null);
        setFreehandPoints([]);
      }
      return;
    }

    if (moved >= 4) return;

    const pt = vp.screenToSvg(e.clientX, e.clientY);

    if (activeTool === 'point') {
      setPendingBuildingPos(pt);
      return;
    }

    if (activeTool === 'polygon') {
      if (tempPoints.length >= 3) {
        const first = tempPoints[0];
        if (svgDistToScreenPx(pt, first) <= CLOSE_SNAP_PX) {
          setFinalPoints(tempPoints);
          return;
        }
      }
      setTempPoints((p) => [...p, pt]);
    }
  }

  const pointsToSvg = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const visibleBuildings = activeDistrictFilter
    ? buildings.filter((b) => b.district_id === activeDistrictFilter)
    : buildings;

  const previewBoxPoints = (() => {
    if (!dragBox || !activeTool) return null;
    const { start, end } = dragBox;
    if (activeTool === 'circle') return circleFromBox(start.x, start.y, end.x, end.y);
    if (activeTool === 'ellipse') return ellipseFromBox(start.x, start.y, end.x, end.y);
    if (activeTool === 'square') return squareFromBox(start.x, start.y, end.x, end.y);
    if (activeTool === 'trapezoid') return trapezoidFromBox(start.x, start.y, end.x, end.y);
    return null;
  })();

  const showGrid = editMode && activeTool !== null;
  const closeSnapReady = activeTool === 'polygon' && tempPoints.length >= 3;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-panel2">
      <div className="stamp-bar absolute left-0 top-0 z-30 h-1 w-full" />

      <Link
        href="/carte"
        className="absolute left-4 top-6 z-20 border border-white/15 bg-panel/90 px-3 py-1.5 font-display text-[10px] uppercase tracking-wide text-accent hover:border-accent"
      >
        ← Retour à la carte du monde
      </Link>

      <div className="absolute left-4 top-16 z-20 border border-white/10 bg-panel/90 px-3 py-1.5 font-display text-sm text-paper">
        {city?.name}
      </div>

      {canEdit && (
        <div className="dossier-corner absolute left-4 top-28 z-20 max-w-[calc(100%-2rem)] space-y-2 border border-white/15 bg-panel/95 p-2.5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditMode((v) => !v);
                resetDrawing();
              }}
              className={`border px-3 py-1.5 font-display text-xs uppercase tracking-wide ${
                editMode ? 'border-accent bg-accent text-paper' : 'border-white/20 text-paper/70'
              }`}
            >
              {editMode ? 'Édition : active' : 'Mode édition'}
            </button>
            {editMode && (
              <button
                onClick={() => {
                  setActiveTool('point');
                  setTempPoints([]);
                }}
                className={`border px-2 py-1.5 font-display text-xs ${
                  activeTool === 'point' ? 'border-accent bg-accent text-paper' : 'border-white/15 text-paper/70'
                }`}
              >
                🏗 Ajouter un bâtiment
              </button>
            )}
          </div>
          {editMode && (
            <ShapeToolbar
              active={activeTool !== 'point' ? (activeTool as ShapeTool | null) : null}
              onSelect={selectTool}
              pointsCount={tempPoints.length}
              canFinish={tempPoints.length >= 3}
              onFinish={() => setFinalPoints(tempPoints)}
              onCancel={resetDrawing}
            />
          )}
        </div>
      )}

      <div className="absolute right-4 top-6 z-20">
        <ZoomControls onZoomIn={vp.zoomIn} onZoomOut={vp.zoomOut} onReset={vp.resetView} />
      </div>

      {districts.length > 0 && (
        <div className="absolute right-4 top-32 z-20 flex flex-col gap-1 border border-white/15 bg-panel/90 p-2 font-display text-[10px] uppercase">
          <button
            onClick={() => setActiveDistrictFilter(null)}
            className={!activeDistrictFilter ? 'text-accent' : 'text-paper/60 hover:text-accent'}
          >
            Tous les quartiers
          </button>
          {districts.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDistrictFilter(d.id)}
              className={activeDistrictFilter === d.id ? 'text-accent' : 'text-paper/60 hover:text-accent'}
              style={{ borderLeft: `3px solid ${d.color}`, paddingLeft: 6 }}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-xs uppercase tracking-widest2 text-paper/50">
          Chargement du plan…
        </p>
      )}

      <svg
        ref={vp.svgRef}
        viewBox={vp.viewBoxString}
        className={`h-full w-full select-none ${
          editMode && activeTool ? 'cursor-crosshair' : vp.isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onWheel={vp.handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (vp.isPanning) vp.endPan();
        }}
      >
        <rect x={-50} y={-50} width={200} height={200} fill="#2a2419" />

        {districts.map((d) => (
          <polygon
            key={d.id}
            points={pointsToSvg(d.path_points)}
            fill={d.color}
            fillOpacity={activeDistrictFilter && activeDistrictFilter !== d.id ? 0.1 : 0.35}
            stroke="#00000066"
            strokeWidth={0.15}
          />
        ))}

        {showGrid && <GridOverlay viewBox={vp.viewBox} />}

        {tempPoints.length > 0 && (
          <>
            <polyline
              points={pointsToSvg(tempPoints)}
              fill="none"
              stroke="#b3261e"
              strokeWidth={0.25}
              strokeDasharray="0.7"
            />
            {tempPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === 0 && closeSnapReady ? 0.9 : 0.45}
                fill={i === 0 && closeSnapReady ? '#b3261e' : '#f4ecd8'}
              />
            ))}
          </>
        )}

        {previewBoxPoints && (
          <polygon
            points={pointsToSvg(previewBoxPoints)}
            fill="#b3261e"
            fillOpacity={0.3}
            stroke="#b3261e"
            strokeWidth={0.25}
          />
        )}
        {activeTool === 'freehand' && freehandPoints.length > 1 && (
          <polyline points={pointsToSvg(freehandPoints)} fill="none" stroke="#b3261e" strokeWidth={0.3} />
        )}

        {visibleBuildings.map((b) => (
          <g
            key={b.id}
            transform={`translate(${b.x}, ${b.y}) rotate(${b.rotation})`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (!activeTool) setSelectedBuilding(b);
            }}
          >
            <rect
              x={-b.width / 2}
              y={-b.height / 2}
              width={b.width}
              height={b.height}
              fill="#151312"
              stroke="#b3261e"
              strokeWidth={0.1}
            />
            <text textAnchor="middle" dy="0.6" fontSize="1.8" fill="#e7e5db">
              {BUILDING_ICONS[b.type] ?? '■'}
            </text>
          </g>
        ))}
      </svg>

      {selectedBuilding && (
        <BuildingDetailPanel building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      )}

      {finalPoints && (
        <DistrictFormModal
          cityId={cityId}
          points={finalPoints}
          onClose={resetDrawing}
          onSaved={() => {
            resetDrawing();
            load();
          }}
        />
      )}

      {pendingBuildingPos && (
        <BuildingFormModal
          cityId={cityId}
          districtId={activeDistrictFilter}
          position={pendingBuildingPos}
          onClose={resetDrawing}
          onSaved={() => {
            resetDrawing();
            load();
          }}
        />
      )}

      <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 border border-white/10 bg-panel/80 px-4 py-1 font-display text-[10px] uppercase tracking-wide text-paper/50">
        {editMode && activeTool === 'polygon'
          ? 'Clique pour ajouter un point · reclique sur le premier point pour fermer'
          : editMode && activeTool
          ? 'Clique-glisse pour dessiner'
          : 'Glisse pour naviguer · molette pour zoomer'}
      </div>
    </div>
  );
}
