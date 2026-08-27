'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import { useSvgViewport } from '@/lib/hooks/useSvgViewport';
import type { MapPlace, MapZone, MarkerShape, Point } from '@/lib/types';
import { ZONE_LABELS } from '@/lib/types';
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
import DetailPanel from './DetailPanel';
import ZoneFormModal from './ZoneFormModal';
import PlaceFormModal from './PlaceFormModal';
import ShapeToolbar from './ShapeToolbar';
import ZoomControls from './ZoomControls';
import GridOverlay from './GridOverlay';
import MapLegend from './MapLegend';
import Navbar from '@/components/layout/Navbar';
import { useTypeConfig } from '@/lib/hooks/useTypeConfig';

const CLOSE_SNAP_PX = 14;
type PointTool = 'point-circle' | 'point-rect';
type ActiveTool = ShapeTool | PointTool | null;

export default function WorldMap() {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');
  const vp = useSvgViewport();
  const placeTypes = useTypeConfig('place');

  const [zones, setZones] = useState<MapZone[]>([]);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<{ kind: 'zone' | 'place'; entity: MapZone | MapPlace } | null>(
    null
  );

  const [editMode, setEditMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [dragBox, setDragBox] = useState<{ start: Point; end: Point } | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [finalPoints, setFinalPoints] = useState<Point[] | null>(null);
  const [pendingPlace, setPendingPlace] = useState<{
    pos: Point;
    radius: number;
    shape: MarkerShape;
  } | null>(null);

  const downRef = useRef<null | { x: number; y: number }>(null);

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

  function resetDrawing() {
    setActiveTool(null);
    setTempPoints([]);
    setDragBox(null);
    setFreehandPoints([]);
    setFinalPoints(null);
    setPendingPlace(null);
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

  async function deleteZone(z: MapZone) {
    if (!confirm(`Supprimer la zone "${z.name}" ?`)) return;
    await supabase.from('map_zones').delete().eq('id', z.id);
    load();
  }
  async function deletePlace(p: MapPlace) {
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
    await supabase.from('map_places').delete().eq('id', p.id);
    load();
  }

  function handleMouseDown(e: React.MouseEvent) {
    downRef.current = { x: e.clientX, y: e.clientY };
    if (e.button !== 0) return;

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
      const radius = moved >= 5 ? Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)) : 3;
      setPendingPlace({ pos: start, radius, shape: 'circle' });
    } else {
      if (moved >= 5) {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const w = Math.max(2, Math.abs(end.x - start.x));
        const h = Math.max(2, Math.abs(end.y - start.y));
        setPendingPlace({ pos: { x: cx, y: cy }, radius: Math.max(w, h) / 2, shape: 'rect' });
      } else {
        setPendingPlace({ pos: start, radius: 4, shape: 'rect' });
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

  function handleMouseUp(e: React.MouseEvent) {
    const start = downRef.current;
    downRef.current = null;
    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 0;

    if (vp.isPanning) {
      vp.endPan();
      if (moved < 4) setSelected(null);
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

  function pointsToSvg(points: Point[]) {
    return points.map((p) => `${p.x},${p.y}`).join(' ');
  }

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
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    return { rectX: Math.min(start.x, end.x), rectY: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) };
  })();

  const showGrid = editMode && activeTool !== null;
  const closeSnapReady = activeTool === 'polygon' && tempPoints.length >= 3;

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <Navbar />
      <div className="relative flex-1 overflow-hidden">
      {canEdit && (
        <div className="glass-strong absolute left-4 top-6 z-20 max-w-[calc(100%-2rem)] space-y-2 rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditMode((v) => !v);
                resetDrawing();
                setDeleteMode(false);
              }}
              className={`rounded-lg px-3 py-1.5 font-display text-xs uppercase tracking-wide transition ${
                editMode ? 'btn-accent text-paper' : 'border border-white/20 bg-white/5 text-paper/70'
              }`}
            >
              {editMode ? 'Édition : active' : 'Mode édition'}
            </button>

            {editMode && (
              <>
                <button
                  onClick={() => selectPointTool('point-circle')}
                  className={`rounded-lg border px-2.5 py-1.5 font-display text-xs transition ${
                    activeTool === 'point-circle'
                      ? 'btn-accent border-transparent text-paper'
                      : 'border-white/15 bg-white/5 text-paper/70'
                  }`}
                >
                  ⚬ Lieu (rond)
                </button>
                <button
                  onClick={() => selectPointTool('point-rect')}
                  className={`rounded-lg border px-2.5 py-1.5 font-display text-xs transition ${
                    activeTool === 'point-rect'
                      ? 'btn-accent border-transparent text-paper'
                      : 'border-white/15 bg-white/5 text-paper/70'
                  }`}
                >
                  ▭ Lieu (rectangle)
                </button>
                <button
                  onClick={toggleDeleteMode}
                  className={`rounded-lg border px-2.5 py-1.5 font-display text-xs transition ${
                    deleteMode
                      ? 'border-transparent bg-accent text-paper'
                      : 'border-accent/40 bg-accent/10 text-accent'
                  }`}
                >
                  🗑 {deleteMode ? 'Suppression active' : 'Mode suppression'}
                </button>
              </>
            )}
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
              Clique sur une zone ou un lieu pour le supprimer définitivement.
            </p>
          )}
        </div>
      )}

      <div className="absolute right-4 top-6 z-20">
        <ZoomControls onZoomIn={vp.zoomIn} onZoomOut={vp.zoomOut} onReset={vp.resetView} />
      </div>

      {loading && (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-xs uppercase tracking-widest2 text-paper/50">
          Chargement de la carte…
        </p>
      )}

      <svg
        ref={vp.svgRef}
        viewBox={vp.viewBoxString}
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (vp.isPanning) vp.endPan();
        }}
      >
        <rect x={-50} y={-50} width={200} height={200} fill="#0c1a2e" />

        {zones.map((z) => (
          <polygon
            key={z.id}
            points={pointsToSvg(z.path_points)}
            fill={z.color}
            fillOpacity={0.75}
            stroke={deleteMode ? '#b3261e' : '#00000066'}
            strokeWidth={deleteMode ? 0.3 : 0.15}
            className="cursor-pointer transition hover:brightness-110"
            onClick={(e) => {
              e.stopPropagation();
              if (deleteMode) return deleteZone(z);
              if (!activeTool) setSelected({ kind: 'zone', entity: z });
            }}
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
                fill={i === 0 && closeSnapReady ? '#b3261e' : '#e7e5db'}
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

        {pointPreview && 'r' in pointPreview && (
          <circle cx={pointPreview.cx} cy={pointPreview.cy} r={pointPreview.r} fill="#b3261e" fillOpacity={0.3} stroke="#b3261e" strokeWidth={0.25} />
        )}
        {pointPreview && 'rectX' in pointPreview && (
          <rect x={pointPreview.rectX} y={pointPreview.rectY} width={pointPreview.w} height={pointPreview.h} fill="#b3261e" fillOpacity={0.3} stroke="#b3261e" strokeWidth={0.25} />
        )}

        {places.map((p) => {
          const r = p.radius ?? 3;
          const w = p.width ?? r * 2;
          const h = p.height ?? r * 2;
          const iconSize = p.shape === 'rect' ? Math.min(w, h) * 0.4 : r * 0.85;
          const labelOffset = (p.shape === 'rect' ? h / 2 : r) + 2;

          return (
            <g
              key={p.id}
              transform={`translate(${p.x}, ${p.y})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (deleteMode) return deletePlace(p);
                if (!activeTool) setSelected({ kind: 'place', entity: p });
              }}
            >
              {p.shape === 'rect' ? (
                <rect
                  x={-w / 2}
                  y={-h / 2}
                  width={w}
                  height={h}
                  rx={0.6}
                  fill="#151312"
                  stroke={deleteMode ? '#b3261e' : '#b3261e'}
                  strokeWidth={deleteMode ? 0.35 : 0.15}
                />
              ) : (
                <circle r={r} fill="#151312" fillOpacity={0.9} stroke="#b3261e" strokeWidth={deleteMode ? 0.35 : 0.15} />
              )}
              <text textAnchor="middle" dy={iconSize * 0.35} fontSize={iconSize} fill="#e7e5db">
                {p.icon || placeTypes.iconFor(p.type)}
              </text>
              <text
                textAnchor="middle"
                dy={labelOffset}
                fontSize="1.3"
                fill="#e7e5db"
                className="select-none"
                style={{ paintOrder: 'stroke', stroke: '#0c1a2e', strokeWidth: 0.3 }}
              >
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>

      {selected && (
        <DetailPanel
          entity={selected.entity}
          kind={selected.kind}
          onClose={() => setSelected(null)}
          onDeleted={load}
        />
      )}

      {finalPoints && (
        <ZoneFormModal
          points={finalPoints}
          onClose={resetDrawing}
          onSaved={() => {
            resetDrawing();
            load();
          }}
        />
      )}

      {pendingPlace && (
        <PlaceFormModal
          position={pendingPlace.pos}
          zones={zones}
          initialRadius={pendingPlace.radius}
          initialShape={pendingPlace.shape}
          onClose={resetDrawing}
          onSaved={() => {
            resetDrawing();
            load();
          }}
        />
      )}

      <MapLegend
        sections={[
          {
            title: 'Lieux',
            category: 'place',
            items: placeTypes.items.map((it) => ({ key: it.key, icon: it.icon, label: it.label })),
            onIconChange: placeTypes.setIcon
          },
          {
            title: 'Zones',
            items: Object.entries(ZONE_LABELS).map(([type, label]) => ({
              key: type,
              color: zones.find((z) => z.type === type)?.color ?? '#60a5fa',
              label
            }))
          }
        ]}
      />

      <div className="glass absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-4 py-1.5 font-display text-[10px] uppercase tracking-wide text-paper/60">
        {deleteMode
          ? 'Clique un élément pour le supprimer'
          : editMode && activeTool === 'polygon'
          ? 'Clique pour ajouter un point · reclique sur le premier pour fermer'
          : editMode && (activeTool === 'point-circle' || activeTool === 'point-rect')
          ? 'Clique-glisse pour définir la taille, ou clique simple pour une taille par défaut'
          : editMode && activeTool
          ? 'Clique-glisse pour dessiner'
          : "Glisse pour naviguer · molette pour zoomer · clique un élément pour l'explorer"}
      </div>
      </div>
    </div>
  );
}
