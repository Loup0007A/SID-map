'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import { useSvgViewport } from '@/lib/hooks/useSvgViewport';
import type { CityBuilding, CityDistrict, MapPlace, MapRoute, MarkerShape, Point } from '@/lib/types';
import type { ShapeTool } from '@/lib/drawTools';
import { DRAG_SHAPES } from '@/lib/drawTools';
import {
  circleFromBox,
  ellipseFromBox,
  rectangleFromBox,
  simplifyFreehand,
  squareFromBox,
  trapezoidFromBox
} from '@/lib/shapes';
import DistrictFormModal from './DistrictFormModal';
import BuildingFormModal from './BuildingFormModal';
import BuildingDetailPanel from './BuildingDetailPanel';
import ShapeToolbar from '@/components/map/ShapeToolbar';
import ZoomControls from '@/components/map/ZoomControls';
import GridOverlay from '@/components/map/GridOverlay';
import MapLegend from '@/components/map/MapLegend';
import MapActionStack from '@/components/map/MapActionStack';
import PresencePanel from '@/components/map/PresencePanel';
import PositionPickerModal from '@/components/map/PositionPickerModal';
import Navbar from '@/components/layout/Navbar';
import { useTypeConfig } from '@/lib/hooks/useTypeConfig';
import { usePositions } from '@/lib/hooks/usePositions';
import { useMapSettings } from '@/lib/hooks/useMapSettings';
import { useToast } from '@/components/ui/Toast';
import { isImageIcon } from '@/lib/icons';
import { SidIcon } from '@/components/icons/SidIcon';

const CLOSE_SNAP_PX = 14;

// Toits des bâtiments selon leur type (Lot 92).
const ROOF: Record<string, string> = {
  maison: '#c4572b',
  cathedrale: '#6f7f93',
  auberge: '#c8963e',
  commerce: '#1e9a9a',
  autre: '#a89a86',
};

function centroid(pts: Point[]): Point {
  if (!pts.length) return { x: 0, y: 0 };
  return { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
}

/** Enveloppe convexe (remparts autour des quartiers et des bâtiments). */
function hull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Point[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: Point[] = [];
  for (const q of [...p].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
type PointTool = 'point-circle' | 'point-rect';
type ActiveTool = ShapeTool | PointTool | null;

export default function CityMap({ cityId }: { cityId: string }) {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');
  const vp = useSvgViewport();
  const buildingTypes = useTypeConfig('building');
  const positionsHook = usePositions();
  const mapSettings = useMapSettings();
  const { showToast } = useToast();
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [openBuildingPresence, setOpenBuildingPresence] = useState<string | null>(null);
  const [allPlaces, setAllPlaces] = useState<MapPlace[]>([]);
  const [allRoutes, setAllRoutes] = useState<MapRoute[]>([]);

  useEffect(() => {
    if (!showPositionPicker || allPlaces.length > 0) return;
    supabase
      .from('map_places')
      .select('*')
      .then(({ data }) => setAllPlaces((data as MapPlace[]) ?? []));
    supabase
      .from('map_routes')
      .select('*')
      .then(({ data }) => setAllRoutes((data as MapRoute[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPositionPicker]);

  const [city, setCity] = useState<MapPlace | null>(null);
  const [districts, setDistricts] = useState<CityDistrict[]>([]);
  const [buildings, setBuildings] = useState<CityBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuilding | null>(null);
  const [activeDistrictFilter, setActiveDistrictFilter] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [dragBox, setDragBox] = useState<{ start: Point; end: Point } | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [finalPoints, setFinalPoints] = useState<Point[] | null>(null);
  const [pendingBuilding, setPendingBuilding] = useState<{
    pos: Point;
    size: { width: number; height: number };
    shape: MarkerShape;
  } | null>(null);

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
    setPendingBuilding(null);
  }

  function selectTool(t: ShapeTool) {
    setDeleteMode(false);
    setActiveTool(t);
    setTempPoints([]);
    setDragBox(null);
    setFreehandPoints([]);
  }

  function selectPointTool(t: PointTool) {
    setDeleteMode(false);
    setActiveTool(t);
    setTempPoints([]);
  }

  function toggleDeleteMode() {
    setDeleteMode((v) => !v);
    resetDrawing();
  }

  async function deleteDistrict(d: CityDistrict) {
    if (!confirm(`Supprimer le quartier "${d.name}" ?`)) return;
    const { error } = await supabase.from('city_districts').delete().eq('id', d.id);
    if (error) return showToast(`Suppression impossible : ${error.message}`, 'error');
    showToast('Quartier supprimé.');
    load();
  }
  async function deleteBuilding(b: CityBuilding) {
    if (!confirm(`Supprimer "${b.name || b.type}" et tous ses étages ?`)) return;
    const { error } = await supabase.from('city_buildings').delete().eq('id', b.id);
    if (error) return showToast(`Suppression impossible : ${error.message}`, 'error');
    showToast('Bâtiment supprimé.');
    load();
  }

  const cityPositions = positionsHook.positions.filter((p) => p.place_id === cityId);

  function handlePointerDown(e: React.PointerEvent) {
    vp.trackPointerDown(e);
    if (vp.isMultiTouch()) {
      downRef.current = null;
      setDragBox(null);
      setFreehandPoints([]);
      return;
    }

    downRef.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!editMode || activeTool === null) {
      vp.startPan(e.clientX, e.clientY);
      return;
    }
    if (activeTool === 'point-circle' || activeTool === 'point-rect') {
      const pt = vp.screenToSvg(e.clientX, e.clientY);
      setDragBox({ start: pt, end: pt });
      return;
    }
    if (DRAG_SHAPES.includes(activeTool as ShapeTool)) {
      const pt = vp.screenToSvg(e.clientX, e.clientY);
      if (activeTool === 'freehand') setFreehandPoints([pt]);
      else setDragBox({ start: pt, end: pt });
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (vp.trackPointerMove(e)) return;

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
      else if (activeTool === 'rectangle') pts = rectangleFromBox(start.x, start.y, end.x, end.y);
      else if (activeTool === 'trapezoid') pts = trapezoidFromBox(start.x, start.y, end.x, end.y);
      setDragBox(null);
      if (pts.length >= 3) setFinalPoints(pts);
      else resetDrawing();
    }
  }

  function finalizePointDrag(moved: number) {
    if (!dragBox) return;
    const { start, end } = dragBox;

    if (activeTool === 'point-circle') {
      const r = moved >= 5 ? Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)) : 2;
      setPendingBuilding({ pos: start, size: { width: r * 2, height: r * 2 }, shape: 'circle' });
    } else {
      if (moved >= 5) {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const w = Math.max(2, Math.abs(end.x - start.x));
        const h = Math.max(2, Math.abs(end.y - start.y));
        setPendingBuilding({ pos: { x: cx, y: cy }, size: { width: w, height: h }, shape: 'rect' });
      } else {
        setPendingBuilding({ pos: start, size: { width: 4, height: 4 }, shape: 'rect' });
      }
    }
    setDragBox(null);
  }

  function svgDistToScreenPx(a: Point, b: Point) {
    const svg = vp.svgRef.current;
    if (!svg) return Infinity;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / vp.viewBox.w;
    return Math.hypot(a.x - b.x, a.y - b.y) * scale;
  }

  function handlePointerUp(e: React.PointerEvent) {
    vp.trackPointerUp(e);
    if (vp.isMultiTouch()) return;

    const start = downRef.current;
    downRef.current = null;
    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 0;

    if (vp.isPanning) {
      vp.endPan();
      return;
    }
    if (!editMode || !activeTool) return;

    if (activeTool === 'point-circle' || activeTool === 'point-rect') {
      finalizePointDrag(moved);
      return;
    }

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
    if (activeTool === 'rectangle') return rectangleFromBox(start.x, start.y, end.x, end.y);
    if (activeTool === 'trapezoid') return trapezoidFromBox(start.x, start.y, end.x, end.y);
    return null;
  })();

  const pointPreview = (() => {
    if (!dragBox || (activeTool !== 'point-circle' && activeTool !== 'point-rect')) return null;
    const { start, end } = dragBox;
    if (activeTool === 'point-circle') {
      return { cx: start.x, cy: start.y, r: Math.hypot(end.x - start.x, end.y - start.y) };
    }
    return {
      rectX: Math.min(start.x, end.x),
      rectY: Math.min(start.y, end.y),
      w: Math.abs(end.x - start.x),
      h: Math.abs(end.y - start.y)
    };
  })();

  // Remparts : l'enveloppe des quartiers et des bâtiments, élargie de 3 unités.
  const walls = (() => {
    const pts = [...districts.flatMap((d) => d.path_points), ...buildings.map((b) => ({ x: b.x, y: b.y }))];
    if (pts.length < 3) return null;
    const h = hull(pts);
    const c = centroid(h);
    return h.map((p) => {
      const d = Math.hypot(p.x - c.x, p.y - c.y) || 1;
      return { x: p.x + ((p.x - c.x) / d) * 3, y: p.y + ((p.y - c.y) / d) * 3 };
    });
  })();
  const showGrid = editMode && activeTool !== null;
  const closeSnapReady = activeTool === 'polygon' && tempPoints.length >= 3;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden">
      <Navbar />
      <div className="relative flex-1 overflow-hidden">
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col items-start gap-2 md:left-4 md:top-4">
        <Link href="/carte" className="back-link pointer-events-auto text-sm">
          ← Carte du monde
        </Link>
        <div className="city-cartouche pointer-events-auto">
          <span className="section-label">Plan de ville</span>
          <span className="city-cartouche-name">{city?.name ?? '…'}</span>
        </div>
      </div>

      {canEdit && (
        <div className="fixed inset-x-2 bottom-2 z-20 max-w-full md:absolute md:inset-x-auto md:bottom-auto md:left-4 md:top-[9.5rem] md:max-w-[calc(100%-2rem)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {!toolbarOpen ? (
            <button
              onClick={() => setToolbarOpen(true)}
              className="glass-strong flex items-center gap-2 rounded-full px-4 py-2.5 font-display text-xs uppercase tracking-wide text-accent"
            >
              <SidIcon name="tools" /> Outils
            </button>
          ) : (
            <div className="glass-strong space-y-2 rounded-2xl p-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  onClick={() => {
                    setEditMode((v) => !v);
                    resetDrawing();
                    setDeleteMode(false);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 font-display text-xs uppercase tracking-wide transition ${
                    editMode ? 'btn-accent text-paper' : 'border border-white/20 bg-white/5 text-paper/70'
                  }`}
                >
                  {editMode ? 'Édition : active' : 'Mode édition'}
                </button>
                {editMode && (
                  <>
                    <button
                      onClick={() => selectPointTool('point-circle')}
                      className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-2 font-display text-xs transition ${
                        activeTool === 'point-circle'
                          ? 'btn-accent border-transparent text-paper'
                          : 'border-white/15 bg-white/5 text-paper/70'
                      }`}
                    >
                      ⚬ Bâtiment (rond)
                    </button>
                    <button
                      onClick={() => selectPointTool('point-rect')}
                      className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-2 font-display text-xs transition ${
                        activeTool === 'point-rect'
                          ? 'btn-accent border-transparent text-paper'
                          : 'border-white/15 bg-white/5 text-paper/70'
                      }`}
                    >
                      ▭ Bâtiment (rectangle)
                    </button>
                    <button
                      onClick={toggleDeleteMode}
                      className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-2 font-display text-xs transition ${
                        deleteMode
                          ? 'border-transparent bg-accent text-paper'
                          : 'border-accent/40 bg-accent/10 text-accent'
                      }`}
                    >
                      <SidIcon name="trash" /> {deleteMode ? 'Suppression active' : 'Mode suppression'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setToolbarOpen(false)}
                  className="ml-auto shrink-0 rounded-lg px-2 py-2 text-paper/65 hover:text-accent md:ml-0"
                  title="Réduire"
                >
                  ▾
                </button>
              </div>
              {editMode && !deleteMode && (
                <ShapeToolbar
                  active={
                    activeTool && activeTool !== 'point-circle' && activeTool !== 'point-rect'
                      ? (activeTool as ShapeTool)
                      : null
                  }
                  onSelect={selectTool}
                  pointsCount={tempPoints.length}
                  canFinish={tempPoints.length >= 3}
                  onFinish={() => setFinalPoints(tempPoints)}
                  onCancel={resetDrawing}
                />
              )}
              {deleteMode && (
                <p className="max-w-xs text-[11px] text-accent/90">
                  Clique sur un quartier ou un bâtiment pour le supprimer définitivement.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="absolute right-4 top-6 z-20">
        <ZoomControls onZoomIn={vp.zoomIn} onZoomOut={vp.zoomOut} onReset={vp.resetView} />
      </div>

      {districts.length > 0 && (
        <div className="glass absolute right-4 top-40 z-20 flex max-h-[40vh] flex-col gap-1 overflow-y-auto scrollbar-thin rounded-xl p-2.5 font-display text-[10px] uppercase md:top-32">
          <button
            onClick={() => setActiveDistrictFilter(null)}
            className={!activeDistrictFilter ? 'text-accent' : 'text-paper/60 hover:text-accent'}
          >
            Tous les quartiers
          </button>
          {districts.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDistrictFilter(activeDistrictFilter === d.id ? null : d.id)}
              aria-pressed={activeDistrictFilter === d.id}
              className={`flex items-center gap-1.5 text-left ${activeDistrictFilter === d.id ? 'text-accent' : 'text-paper/70 hover:text-accent'}`}
            >
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm border-2 border-[rgb(var(--encre))]" style={{ background: d.color }} />
              {d.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-xs uppercase tracking-widest2 text-paper/65">
          Chargement du plan…
        </p>
      )}

      <svg
        ref={vp.svgRef}
        viewBox={vp.viewBoxString}
        style={{ touchAction: 'none' }}
        className={`h-full w-full select-none ${
          deleteMode
            ? 'cursor-not-allowed'
            : editMode && activeTool
            ? 'cursor-crosshair'
            : vp.isPanning
            ? 'cursor-grabbing'
            : 'cursor-grab'
        }`}
        onWheel={vp.handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (vp.isPanning) vp.endPan();
        }}
      >
        {/* Plan de ville (Lot 92) : feuille de vélin posée sur la table en terre
            cuite, remparts autour des quartiers, quartiers hachurés et nommés. */}
        <defs>
          <pattern id="city-grid" width={5} height={5} patternUnits="userSpaceOnUse">
            <path d="M5 0H0V5" fill="none" stroke="#2a1408" strokeOpacity={0.09} strokeWidth={0.06} />
          </pattern>
          <pattern id="city-tiles" width={0.9} height={0.9} patternUnits="userSpaceOnUse">
            <path d="M0 0.9H0.9M0.45 0V0.45" stroke="#2a1408" strokeOpacity={0.35} strokeWidth={0.07} />
          </pattern>
          {districts.map((d) => (
            <pattern key={d.id} id={`hatch-${d.id}`} width={1.6} height={1.6} patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
              <rect width={1.6} height={1.6} fill={d.color} fillOpacity={0.16} />
              <path d="M0 0V1.6" stroke={d.color} strokeOpacity={0.55} strokeWidth={0.28} />
            </pattern>
          ))}
        </defs>
        <rect x={-48} y={-47} width={200} height={200} rx={2} style={{ fill: 'rgb(var(--encre))' }} />
        <rect x={-50} y={-50} width={200} height={200} rx={2} fill="#efe2c3" />
        <rect x={-50} y={-50} width={200} height={200} fill="url(#city-grid)" />
        <rect x={-50} y={-50} width={200} height={200} rx={2} fill="none" style={{ stroke: 'rgb(var(--encre))' }} strokeWidth={0.8} />

        {walls && (
          <g style={{ pointerEvents: 'none' }}>
            <polygon points={pointsToSvg(walls)} fill="#e6d4ae" stroke="#2a1408" strokeWidth={1.3} strokeLinejoin="round" />
            <polygon points={pointsToSvg(walls)} fill="none" stroke="#efe2c3" strokeWidth={0.5} strokeDasharray="0.9 0.9" strokeLinejoin="round" />
            {walls.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={1.5} fill="#cdb78d" stroke="#2a1408" strokeWidth={0.35} />
            ))}
          </g>
        )}

        {districts.map((d) => (
          <polygon
            key={d.id}
            points={pointsToSvg(d.path_points)}
            fill={`url(#hatch-${d.id})`}
            fillOpacity={activeDistrictFilter && activeDistrictFilter !== d.id ? 0.25 : 1}
            stroke={deleteMode ? '#c23a2b' : '#2a1408'}
            strokeOpacity={deleteMode ? 1 : 0.55}
            strokeWidth={deleteMode ? 0.4 : 0.25}
            strokeDasharray={deleteMode ? undefined : '1 0.6'}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (deleteMode) deleteDistrict(d);
            }}
          />
        ))}
        {districts.map((d) => {
          // Nom du quartier près de son bord haut (le centre porte souvent un bâtiment).
          const c = centroid(d.path_points);
          const minY = Math.min(...d.path_points.map((p) => p.y));
          const y = Math.min(c.y, minY + 6);
          return (
            <text key={`n-${d.id}`} x={c.x} y={y} textAnchor="middle" className="district-label" style={{ pointerEvents: 'none' }}>
              {d.name}
            </text>
          );
        })}

        {/* Rose des vents. */}
        <g transform="translate(92 92)" style={{ pointerEvents: 'none' }} opacity={0.85}>
          <circle r={5} fill="#efe2c3" stroke="#2a1408" strokeWidth={0.2} />
          {[0, 90, 180, 270].map((a) => (
            <path key={a} d="M0 -4.6L0.9 0L-0.9 0Z" transform={`rotate(${a})`} fill={a === 0 ? '#c4572b' : '#2a1408'} />
          ))}
          {[45, 135, 225, 315].map((a) => (
            <path key={a} d="M0 -2.8L0.55 0L-0.55 0Z" transform={`rotate(${a})`} fill="#2a1408" fillOpacity={0.6} />
          ))}
          <text y={-5.6} textAnchor="middle" fontSize={1.6} className="district-label" style={{ fontSize: 1.6 }}>
            N
          </text>
        </g>

        {showGrid && <GridOverlay viewBox={vp.viewBox} />}

        {tempPoints.length > 0 && (
          <>
            <polyline
              points={pointsToSvg(tempPoints)}
              fill="none"
              stroke="#d2463b"
              strokeWidth={0.25}
              strokeDasharray="0.7"
            />
            {tempPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === 0 && closeSnapReady ? 0.9 : 0.45}
                fill={i === 0 && closeSnapReady ? '#d2463b' : '#2e261d'}
              />
            ))}
          </>
        )}

        {previewBoxPoints && (
          <polygon
            points={pointsToSvg(previewBoxPoints)}
            fill="#d2463b"
            fillOpacity={0.3}
            stroke="#d2463b"
            strokeWidth={0.25}
          />
        )}
        {activeTool === 'freehand' && freehandPoints.length > 1 && (
          <polyline points={pointsToSvg(freehandPoints)} fill="none" stroke="#d2463b" strokeWidth={0.3} />
        )}

        {pointPreview && 'r' in pointPreview && (
          <circle cx={pointPreview.cx} cy={pointPreview.cy} r={pointPreview.r} fill="#d2463b" fillOpacity={0.3} stroke="#d2463b" strokeWidth={0.25} />
        )}
        {pointPreview && 'rectX' in pointPreview && (
          <rect x={pointPreview.rectX} y={pointPreview.rectY} width={pointPreview.w} height={pointPreview.h} fill="#d2463b" fillOpacity={0.3} stroke="#d2463b" strokeWidth={0.25} />
        )}

        {visibleBuildings.map((b) => {
          const radius = b.width / 2;
          const occupants = cityPositions.filter((p) => p.building_id === b.id);
          const roof = ROOF[b.type] ?? ROOF.autre;
          const badge = Math.min(2.2, Math.max(1.1, Math.min(b.width, b.height) * 0.3));
          const top = b.shape === 'circle' ? radius : b.height / 2;
          return (
            <g
              key={b.id}
              transform={`translate(${b.x}, ${b.y})`}
              className="city-building cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (deleteMode) return deleteBuilding(b);
                if (occupants.length > 0 && !activeTool) {
                  setOpenBuildingPresence(openBuildingPresence === b.id ? null : b.id);
                  return;
                }
                if (!activeTool) setSelectedBuilding(b);
              }}
            >
              <g transform={`rotate(${b.rotation})`}>
                {b.shape === 'circle' ? (
                  <>
                    <circle cx={0.45} cy={0.7} r={radius} style={{ fill: 'rgb(var(--encre))' }} />
                    <circle r={radius} fill={roof} stroke={deleteMode ? '#c23a2b' : '#2a1408'} strokeWidth={deleteMode ? 0.45 : 0.3} />
                    <circle r={radius * 0.62} fill="none" stroke="#2a1408" strokeOpacity={0.35} strokeWidth={0.18} />
                    <circle r={radius} fill="url(#city-tiles)" opacity={0.6} />
                  </>
                ) : (
                  <>
                    <rect x={-b.width / 2 + 0.45} y={-b.height / 2 + 0.7} width={b.width} height={b.height} rx={0.3} style={{ fill: 'rgb(var(--encre))' }} />
                    <rect x={-b.width / 2} y={-b.height / 2} width={b.width} height={b.height} rx={0.3} fill={roof} stroke={deleteMode ? '#c23a2b' : '#2a1408'} strokeWidth={deleteMode ? 0.45 : 0.3} />
                    <rect x={-b.width / 2} y={-b.height / 2} width={b.width} height={b.height} fill="url(#city-tiles)" opacity={0.55} />
                    {b.width >= b.height ? (
                      <>
                        <path d={`M${-b.width / 2} ${-b.height / 2}L${-b.width / 2 + b.height / 2} 0L${-b.width / 2} ${b.height / 2}M${b.width / 2} ${-b.height / 2}L${b.width / 2 - b.height / 2} 0L${b.width / 2} ${b.height / 2}`} fill="none" stroke="#2a1408" strokeOpacity={0.5} strokeWidth={0.18} />
                        <path d={`M${-b.width / 2 + b.height / 2} 0H${b.width / 2 - b.height / 2}`} stroke="#2a1408" strokeWidth={0.28} />
                        <rect x={-b.width / 2} y={0} width={b.width} height={b.height / 2} fill="#2a1408" fillOpacity={0.14} />
                      </>
                    ) : (
                      <>
                        <path d={`M${-b.width / 2} ${-b.height / 2}L0 ${-b.height / 2 + b.width / 2}L${b.width / 2} ${-b.height / 2}M${-b.width / 2} ${b.height / 2}L0 ${b.height / 2 - b.width / 2}L${b.width / 2} ${b.height / 2}`} fill="none" stroke="#2a1408" strokeOpacity={0.5} strokeWidth={0.18} />
                        <path d={`M0 ${-b.height / 2 + b.width / 2}V${b.height / 2 - b.width / 2}`} stroke="#2a1408" strokeWidth={0.28} />
                        <rect x={0} y={-b.height / 2} width={b.width / 2} height={b.height} fill="#2a1408" fillOpacity={0.14} />
                      </>
                    )}
                  </>
                )}
              </g>
              {(() => {
                const icon = buildingTypes.iconFor(b.type, '🏗️');
                const s = badge * 1.5;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <circle r={badge} fill="#fbf0dc" stroke="#2a1408" strokeWidth={0.22} />
                    {isImageIcon(icon) ? (
                      <image href={icon} x={-s / 2} y={-s / 2} width={s} height={s} preserveAspectRatio="xMidYMid meet" />
                    ) : (
                      <text textAnchor="middle" dy={badge * 0.38} fontSize={badge * 1.05} fill="#2a1408">
                        {icon}
                      </text>
                    )}
                  </g>
                );
              })()}
              {b.owner_id && (
                <g transform={`translate(${-badge * 0.95} ${-badge * 0.95})`} style={{ pointerEvents: 'none' }}>
                  <title>Propriété d&apos;un membre</title>
                  <circle r={0.75} fill="#f2b33d" stroke="#2a1408" strokeWidth={0.18} />
                  <path d="M-0.35 0.1L0 -0.25L0.35 0.1V0.4H-0.35Z" fill="#2a1408" />
                </g>
              )}
              {b.name && (
                <text y={top + 1.9} textAnchor="middle" className="building-label" style={{ pointerEvents: 'none' }}>
                  {b.name}
                </text>
              )}
              {occupants.length > 0 && (
                <>
                  <circle cx={badge * 0.95} cy={-badge * 0.95} r={0.95} fill="#1e9a9a" stroke="#2a1408" strokeWidth={0.18} />
                  <text x={badge * 0.95} y={-badge * 0.95} dy="0.38" textAnchor="middle" fontSize="1.05" fill="#fff" fontWeight={700}>
                    {occupants.length}
                  </text>
                </>
              )}
              {openBuildingPresence === b.id && (
                <foreignObject x={-40} y={top + 2.4} width={80} height={Math.min(60, 14 * occupants.length + 8)}>
                  <div className="glass-strong rounded-lg p-1.5 text-[7px] leading-tight text-paper">
                    {occupants.map((o) => (
                      <p key={o.user_id} className="truncate">
                        {o.nickname ?? 'Membre'}
                      </p>
                    ))}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>

      {selectedBuilding && (
        <BuildingDetailPanel
          building={selectedBuilding}
          onClose={() => setSelectedBuilding(null)}
          onDeleted={load}
        />
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

      {pendingBuilding && (
        <BuildingFormModal
          cityId={cityId}
          districtId={activeDistrictFilter}
          position={pendingBuilding.pos}
          initialSize={pendingBuilding.size}
          initialShape={pendingBuilding.shape}
          onClose={resetDrawing}
          onSaved={() => {
            resetDrawing();
            load();
          }}
        />
      )}

      {showPositionPicker && (
        <PositionPickerModal
          settings={mapSettings.settings}
          places={allPlaces.length > 0 ? allPlaces : city ? [city] : []}
          routes={allRoutes}
          buildings={buildings}
          cityId={cityId}
          positionsHook={positionsHook}
          onClose={() => setShowPositionPicker(false)}
        />
      )}

      <MapActionStack raised={canEdit && toolbarOpen && editMode}>
        <MapLegend
          sections={[
            {
              title: 'Bâtiments',
              category: 'building',
              items: buildingTypes.items.map((it) => ({ key: it.key, icon: it.icon, label: it.label })),
              onIconChange: buildingTypes.setIcon,
              onAddType: buildingTypes.addType
            },
            {
              title: 'Quartiers',
              items: districts.map((d) => ({ key: d.id, color: d.color, label: d.name }))
            }
          ]}
        />
        <PresencePanel positions={cityPositions} places={city ? [city] : []} routes={[]} />
        <button
          onClick={() => setShowPositionPicker(true)}
          className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[10px] uppercase tracking-wide text-paper/70 hover:text-accent"
        >
          <SidIcon name="pin" /> Ma position
        </button>
      </MapActionStack>

      {/* Consigne du mode en cours : en haut sur téléphone (la barre d'outils occupe le bas). */}
      <div
        role="status"
        className={`glass absolute left-1/2 top-24 z-10 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl px-4 py-1.5 text-center text-xs text-paper/80 md:bottom-3 md:top-auto ${
          editMode ? '' : 'hidden md:block'
        }`}
      >
        {deleteMode
          ? <><SidIcon name="trash" /> Suppression — clique un quartier ou un bâtiment (confirmation demandée)</>
          : editMode && activeTool === 'polygon'
          ? tempPoints.length < 3
            ? `Polygone — ${tempPoints.length} point${tempPoints.length > 1 ? 's' : ''}, il en faut au moins 3 (quartier)`
            : `Polygone — ${tempPoints.length} points · reclique le premier point ou « Terminer »`
          : editMode && (activeTool === 'point-circle' || activeTool === 'point-rect')
          ? 'Bâtiment — clic simple (taille standard) ou clic-glisse (taille au choix)'
          : editMode && activeTool
          ? 'Clic-glisse pour dessiner un quartier'
          : editMode
          ? 'Édition — choisis un outil : une forme (quartier) ou Bâtiment'
          : 'Glisse pour naviguer · molette pour zoomer · clique un bâtiment pour l’ouvrir'}
      </div>
      </div>
    </div>
  );
}
