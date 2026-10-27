'use client';

import Icon from '@/components/ui/Icon';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import { useSvgViewport } from '@/lib/hooks/useSvgViewport';
import type {
  MapBiome,
  MapGroup,
  MapPlace,
  MapQuest,
  MapRelief,
  MapRoute,
  MapZone,
  MarkerShape,
  Point
} from '@/lib/types';
import { ZONE_LABELS } from '@/lib/types';
import { reliefColor } from '@/lib/relief';
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
import { centroid, labelAnchor } from '@/lib/geometry';
import { isImageIcon } from '@/lib/icons';
import type { RoutePlan } from '@/lib/pathfinding';
import ShapeToolbar from './ShapeToolbar';
import ZoomControls from './ZoomControls';
import GridOverlay from './GridOverlay';
import MapLegend from './MapLegend';
import MapActionStack from './MapActionStack';
import PresenceMarkers from './PresenceMarkers';
import PresencePanel from './PresencePanel';
import QuestMarkers from './QuestMarkers';
import TextureOverlays from './TextureOverlays';
import ScaleBar from './ScaleBar';
import { useMapSettings } from '@/lib/hooks/useMapSettings';
import { biomeTextureId, reliefTextureId, findTexture } from '@/lib/textures';
import Modal from '@/components/ui/Modal';
import { useTextures } from '@/lib/hooks/useTextures';
import { APP_EVENT } from '@/lib/apps';
import { exportMapPng } from '@/lib/exportMap';
import { useMountTypes } from '@/lib/hooks/useMountTypes';
import { isQuestFinished } from '@/lib/types';
import TerritoryFlag from './TerritoryFlag';
import PlaceSearch from './PlaceSearch';
import Navbar from '@/components/layout/Navbar';
import { useTypeConfig } from '@/lib/hooks/useTypeConfig';
import { usePositions } from '@/lib/hooks/usePositions';
import { useNow } from '@/lib/hooks/useNow';
import { useGroups } from '@/lib/hooks/useGroups';
import { useToast } from '@/components/ui/Toast';
import { useGuide } from '@/components/guide/GuideProvider';
import MapCoach, { type CoachTip } from '@/components/guide/MapCoach';
import { DEFAULT_SETTINGS } from '@/lib/mapScale';
import { computeRemainingMinutes, formatMinutes, travelerScreenPosition, tripInfo } from '@/lib/travel';
import { distanceUnits, formatDistance } from '@/lib/mapScale';
import { useFavorites } from '@/lib/hooks/useFavorites';
import { useIsDesktop } from '@/components/ui/Modal';
import { SEL_TABLE, parseSel, pointInPolygon, selKey, shiftPoint, shiftPoints, type SelKind } from '@/lib/selection';
import { SidIcon, GlyphText } from '@/components/icons/SidIcon';
import { useEnvers } from '@/components/envers/useEnvers';

// Fenêtres et formulaires chargés à la demande : la carte s'affiche plus vite
// sur téléphone (moins de code à télécharger et à lire au démarrage).
const ZoneFormModal = dynamic(() => import('./ZoneFormModal'), { ssr: false });
const PlaceFormModal = dynamic(() => import('./PlaceFormModal'), { ssr: false });
const PositionPickerModal = dynamic(() => import('./PositionPickerModal'), { ssr: false });
const RouteFormModal = dynamic(() => import('./RouteFormModal'), { ssr: false });
const RouteInfoModal = dynamic(() => import('./RouteInfoModal'), { ssr: false });
const ReliefFormModal = dynamic(() => import('./ReliefFormModal'), { ssr: false });
const BiomeFormModal = dynamic(() => import('./BiomeFormModal'), { ssr: false });
const QuestPopup = dynamic(() => import('./QuestPopup'), { ssr: false });
const TexturePicker = dynamic(() => import('./TexturePicker'), { ssr: false });
const CrystalsModal = dynamic(() => import('./CrystalsModal'), { ssr: false });
const MountsModal = dynamic(() => import('./MountsModal'), { ssr: false });
const FlightPanel = dynamic(() => import('./FlightPanel'), { ssr: false });
const RoutePlannerPanel = dynamic(() => import('./RoutePlannerPanel'), { ssr: false });
const DetailPanel = dynamic(() => import('./DetailPanel'), { ssr: false });
const DirectoryApp = dynamic(() => import('@/components/apps/ExtraApps').then((m) => m.DirectoryApp), { ssr: false });
const NearbyApp = dynamic(() => import('@/components/apps/ExtraApps').then((m) => m.NearbyApp), { ssr: false });
const NotesApp = dynamic(() => import('@/components/apps/ExtraApps').then((m) => m.NotesApp), { ssr: false });

const CLOSE_SNAP_PX = 14;
type PointTool = 'point-circle' | 'point-rect';
type ActiveTool = ShapeTool | PointTool | 'route' | 'select' | null;

/* Encres de la feuille d'atlas (Lot 50). */
const INK = '#2e261d'; // encre ferro-gallique : traits, noms
const VELLUM = '#ece0c2'; // vélin des terres
const SEA = '#c3d2cb'; // mer
const COAST = '#6f9894'; // ombre côtière
const SANGUINE = '#9b3b28'; // routes
const SEL = '#1f5f8f'; // sélection, mesure, tracés : encre de Prusse
const DEFAULT_ROUTE = '#e7c34a';

export default function WorldMap() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { allowed: canEdit, loading: permLoading } = usePermission('manage_map');
  const guide = useGuide();
  const favorites = useFavorites();
  const isDesktop = useIsDesktop();
  // Outil de mesure : deux points cliqués sur la carte.
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePts, setMeasurePts] = useState<Point[]>([]);
  // Sélection multiple (admins) : clés « genre:id », geste en cours, dernier déplacement annulable.
  const [sel, setSel] = useState<string[]>([]);
  const [selDrag, setSelDrag] = useState<{ mode: 'move' | 'marquee'; start: Point; cur: Point; hitKey: string | null } | null>(null);
  const [lastMove, setLastMove] = useState<{ keys: string[]; dx: number; dy: number } | null>(null);
  const [selBusy, setSelBusy] = useState(false);
  // Plusieurs de ces fenêtres peuvent rester ouvertes côte à côte.
  const [extraApps, setExtraApps] = useState<string[]>([]);
  const closeExtra = (id: string) => setExtraApps((a) => a.filter((x) => x !== id));
  const { custom: customTextures } = useTextures();
  const mapSettings = useMapSettings();
  const [showTextures, setShowTextures] = useState(true);
  const [retexture, setRetexture] = useState<{ table: 'map_biomes' | 'map_relief'; id: string; value: string | null } | null>(null);
  const world = mapSettings.settings.world_size;
  const vp = useSvgViewport(world);
  const placeTypes = useTypeConfig('place');
  const positionsHook = usePositions();
  // Les comptes à rebours affichent des minutes : inutile de tout redessiner chaque seconde.
  const now = useNow(15000);
  const groupsHook = useGroups();
  const { showToast } = useToast();
  const envers = useEnvers(!!positionsHook.myUserId, searchParams.get('envers') !== null, () => setSelected(null));

  const [zones, setZones] = useState<MapZone[]>([]);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [quests, setQuests] = useState<MapQuest[]>([]);
  const [openPresenceId, setOpenPresenceId] = useState<string | null>(null);
  const [openQuestPlace, setOpenQuestPlace] = useState<string | null>(null);
  const [relief, setRelief] = useState<MapRelief[]>([]);
  const [biomes, setBiomes] = useState<MapBiome[]>([]);
  const [showRelief, setShowRelief] = useState(false);
  const [showBiomes, setShowBiomes] = useState(false);
  const [editLayer, setEditLayer] = useState<'map' | 'relief' | 'biome'>('map');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [didInitialFocus, setDidInitialFocus] = useState(false);

  const [selected, setSelected] = useState<{ kind: 'zone' | 'place'; entity: MapZone | MapPlace } | null>(
    null
  );
  const [selectedRoute, setSelectedRoute] = useState<MapRoute | null>(null);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [showCrystals, setShowCrystals] = useState(false);
  const [showMounts, setShowMounts] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showBlackMarkets, setShowBlackMarkets] = useState(false);
  const [flightMode, setFlightMode] = useState(false);
  const [flightTarget, setFlightTarget] = useState<MapPlace | null>(null);
  const [flightBusy, setFlightBusy] = useState(false);
  const mountTypes = useMountTypes();
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerTo, setPlannerTo] = useState<string | null>(null);
  const [plannerKey, setPlannerKey] = useState(0);
  const [highlightedPlan, setHighlightedPlan] = useState<RoutePlan | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);
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
  const [routeDraft, setRouteDraft] = useState<{ fromPlaceId: string; points: Point[] } | null>(null);
  const [finalRoute, setFinalRoute] = useState<{ points: Point[]; from: string; to: string } | null>(null);

  const downRef = useRef<null | { x: number; y: number }>(null);

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: routeData }, { data: questData }, { data: reliefData }, { data: biomeData }] =
      await Promise.all([
        supabase.rpc('get_world_map'),
        supabase.from('map_routes').select('*'),
        supabase.rpc('list_map_quests'),
        supabase.from('map_relief').select('id,path_points,elevation,is_published,texture_id'),
        supabase.from('map_biomes').select('id,path_points,biome_type,color,is_published,texture_id')
      ]);
    if (!error && data) {
      setZones(data.zones ?? []);
      setPlaces(data.places ?? []);
    }
    // Sans ça, une panne réseau ressemblait à une carte vide.
    setLoadError(!!error || !data);
    setRoutes((routeData as MapRoute[]) ?? []);
    setQuests(((questData as MapQuest[]) ?? []).filter((q) => !isQuestFinished(q.status)));
    setRelief((reliefData as MapRelief[]) ?? []);
    setBiomes((biomeData as MapBiome[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lien partageable : ?lieu=<id> ouvre et centre automatiquement sur
  // ce lieu au chargement de la page.
  useEffect(() => {
    if (didInitialFocus || loading || !mapSettings.ready || places.length === 0) return;
    const placeId = searchParams.get('lieu');
    if (placeId) {
      const p = places.find((pl) => pl.id === placeId);
      if (p) {
        setSelected({ kind: 'place', entity: p });
        vp.panTo(p.x, p.y, 30, isDesktop ? 0.5 : 0.28);
      }
    }
    setDidInitialFocus(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, places, mapSettings.ready]);

  function selectPlaceAndShare(p: MapPlace) {
    if (measureMode) return; // le clic sert à poser un point de mesure
    if (flightMode) {
      setFlightTarget(p);
      return;
    }
    setSelected({ kind: 'place', entity: p });
    vp.panTo(p.x, p.y, 30, isDesktop ? 0.5 : 0.28);
    const params = new URLSearchParams(searchParams.toString());
    params.set('lieu', p.id);
    router.replace(`/carte?${params.toString()}`, { scroll: false });
  }

  // --- Applications (lanceur de la barre du haut) ---
  const myPlaceForFlight = places.find((p) => p.id === positionsHook.myPosition?.place_id) ?? null;
  const activeMountForFlight = mountTypes.byId(positionsHook.myPosition?.active_mount_id ?? null);

  function runApp(id: string) {
    switch (id) {
      case 'position':
        setShowPositionPicker(true);
        break;
      case 'mounts':
        setShowMounts(true);
        break;
      case 'crystals':
        setShowCrystals(true);
        break;
      case 'itinerary':
        setShowPlanner(true);
        break;
      case 'layers':
        setShowLayers(true);
        break;
      case 'blackmarket':
        setShowBlackMarkets(true);
        break;
      case 'export':
        exportMapPng(vp.svgRef.current, 'carte-du-monde-sid').then((ok) =>
          showToast(ok ? 'Image exportée.' : 'Export impossible depuis ce navigateur.', ok ? 'success' : 'error')
        );
        break;
      case 'directory':
      case 'nearby':
      case 'notes':
        setExtraApps((a) => (a.includes(id) ? a : [...a, id]));
        break;
      case 'measure':
        resetDrawing();
        setEditMode(false);
        setDeleteMode(false);
        setFlightMode(false);
        setSelected(null);
        setMeasurePts([]);
        setMeasureMode(true);
        break;
      case 'help':
        guide.openHelp();
        break;
      case 'edit':
        if (!canEdit) return showToast("L'édition est réservée aux membres ayant la permission « manage_map ».", 'error');
        setToolbarOpen(true);
        setEditMode(true);
        break;
      case 'scale':
        if (!canEdit) return showToast("Le réglage de l'échelle est réservé aux admins de la carte.", 'error');
        window.dispatchEvent(new Event('sid-scale-open'));
        break;
      case 'flight': {
        const pos = positionsHook.myPosition;
        if (!pos?.place_id) return showToast("Fixe d'abord ta position (application « Ma position »).", 'error');
        if (pos.travel_started_at) return showToast('Tu es déjà en voyage.', 'error');
        if (!activeMountForFlight?.can_fly)
          return showToast("Il te faut une monture volante équipée (application « Montures »).", 'error');
        setFlightTarget(null);
        setFlightMode(true);
        break;
      }
    }
  }
  const runAppRef = useRef(runApp);
  runAppRef.current = runApp;

  useEffect(() => {
    const h = (e: Event) => runAppRef.current((e as CustomEvent<string>).detail);
    window.addEventListener(APP_EVENT, h);
    return () => window.removeEventListener(APP_EVENT, h);
  }, []);

  // Application demandée depuis une autre page (?app=…)
  useEffect(() => {
    const id = searchParams.get('app');
    if (!id || loading || permLoading) return;
    runAppRef.current(id);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('app');
    router.replace(params.toString() ? `/carte?${params.toString()}` : '/carte', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, permLoading, searchParams]);

  // --- Accompagnement ---------------------------------------------------
  // Visite proposée d'office à la première venue (et la partie admin le
  // jour où le membre obtient le droit d'édition), ou demandée par ?visite=.
  useEffect(() => {
    if (!guide.ready || loading || permLoading || guide.tourRunning) return;
    const asked = searchParams.get('visite');
    if (asked === 'player' || asked === 'admin') {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('visite');
      router.replace(params.toString() ? `/carte?${params.toString()}` : '/carte', { scroll: false });
      if (asked === 'player' || canEdit) guide.startTour(asked);
      return;
    }
    if (searchParams.get('lieu') || searchParams.get('app')) return; // venu pour autre chose
    if (!guide.state.seenPlayer) guide.startTour(canEdit ? 'full' : 'player');
    else if (canEdit && !guide.state.seenAdmin) guide.startTour('admin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.ready, loading, permLoading, canEdit]);

  // Pendant la visite, on déplie ce que l'étape montre.
  useEffect(() => {
    if (guide.activeStep?.target === 'edit-toolbar') setToolbarOpen(true);
  }, [guide.activeStep]);

  // État réel publié pour les check-lists du centre d'aide.
  const myPos = positionsHook.myPosition;
  const scaleSet =
    mapSettings.settings.km_per_unit !== DEFAULT_SETTINGS.km_per_unit ||
    mapSettings.settings.walk_kmh !== DEFAULT_SETTINGS.walk_kmh;
  useEffect(() => {
    if (loading || loadError || positionsHook.loading) return;
    guide.setFacts({
      hasPosition: !!myPos?.place_id,
      hasMount: !!myPos?.active_mount_id,
      hasStatus: !!myPos?.status,
      zones: zones.length,
      places: places.length,
      routes: routes.length,
      biomes: biomes.length,
      relief: relief.length,
      scaleSet,
      mountTypes: mountTypes.mountTypes.length
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadError, positionsHook.loading, myPos?.place_id, myPos?.active_mount_id, myPos?.status, zones.length, places.length, routes.length, biomes.length, relief.length, scaleSet, mountTypes.mountTypes.length]);
  useEffect(() => () => guide.setFacts(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startPlannedRoute(plan: RoutePlan): Promise<boolean> {
    const { error, message, data } = await positionsHook.startRoutePlan(
      plan.steps.map((st) => ({ routeId: st.route.id, toPlaceId: st.toPlaceId }))
    );
    if (error) {
      showToast(message ?? 'Impossible de partir.', 'error');
      return false;
    }
    const dest = places.find((p) => p.id === plan.placeIds[plan.placeIds.length - 1]);
    showToast(`En route vers ${dest?.name ?? 'ta destination'} — arrivée dans ${formatMinutes(data?.duration_minutes ?? plan.totalMinutes)}.`);
    return true;
  }
  const plannerProps = {
    initialToId: plannerTo,
    places,
    routes,
    onClose: () => {
      setShowPlanner(false);
      setPlannerTo(null);
    },
    onHighlight: setHighlightedPlan,
    myPlaceId: myPos?.travel_started_at ? null : myPos?.place_id ?? null,
    traveling: !!myPos?.travel_started_at,
    speedMultiplier: activeMountForFlight?.speed_multiplier ?? 1,
    mountName: activeMountForFlight?.name ?? null,
    onStart: startPlannedRoute
  };

  async function confirmFlight() {
    if (!flightTarget) return;
    setFlightBusy(true);
    const { error } = await positionsHook.startJourney({ targetPlaceId: flightTarget.id });
    setFlightBusy(false);
    if (error === 'out_of_range') showToast('Trop loin pour cette monture.', 'error');
    else if (error === 'forbidden_biome') showToast('Cette monture ne peut pas traverser ce biome.', 'error');
    else if (error) showToast('Vol impossible.', 'error');
    else {
      showToast('Envol !');
      setFlightMode(false);
      setFlightTarget(null);
    }
  }

  // Vérifie périodiquement si la présence prolongée (1h) sur le lieu
  // d'une quête à laquelle on participe doit la valider.
  useEffect(() => {
    const check = async () => {
      const result = await positionsHook.checkQuestArrival();
      const ok = result?.filter((r) => r.validated) ?? [];
      if (ok.length > 0) {
        const rep = ok.reduce((n, r) => n + (r.reputation ?? 0), 0);
        showToast(`Présence confirmée : quête validée, récompense versée${rep ? `, +${rep} de renommée` : ''} !`, 'success');
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetDrawing() {
    setSel([]);
    setSelDrag(null);
    setActiveTool(null);
    setTempPoints([]);
    setDragBox(null);
    setFreehandPoints([]);
    setFinalPoints(null);
    setPendingPlace(null);
    setRouteDraft(null);
    setFinalRoute(null);
  }

  function selectTool(t: ShapeTool) {
    setDeleteMode(false);
    setActiveTool(t);
    setTempPoints([]);
    setDragBox(null);
    setFreehandPoints([]);
    setRouteDraft(null);
  }

  function selectPointTool(t: PointTool) {
    setDeleteMode(false);
    setActiveTool(t);
    setTempPoints([]);
    setRouteDraft(null);
  }

  function selectSelectTool() {
    resetDrawing();
    setDeleteMode(false);
    setActiveTool('select');
  }

  // --- Sélection multiple ------------------------------------------------
  // Éléments sélectionnables du calque en cours (les lieux d'abord : ils
  // sont dessinés par-dessus les régions).
  function selCandidates(): { key: string; center: Point; hit: (pt: Point) => boolean }[] {
    const poly = (kind: SelKind, list: { id: string; path_points: Point[] }[]) =>
      list.map((e) => ({ key: selKey(kind, e.id), center: centroid(e.path_points), hit: (pt: Point) => pointInPolygon(pt, e.path_points) }));
    if (editLayer === 'relief') return poly('relief', relief);
    if (editLayer === 'biome') return poly('biome', biomes);
    return [
      ...places.map((p) => ({
        key: selKey('place', p.id),
        center: { x: p.x, y: p.y },
        hit: (pt: Point) => {
          const r = p.radius ?? 3;
          if (p.shape === 'rect') return Math.abs(pt.x - p.x) <= (p.width ?? r * 2) / 2 && Math.abs(pt.y - p.y) <= (p.height ?? r * 2) / 2;
          return Math.hypot(pt.x - p.x, pt.y - p.y) <= r;
        }
      })),
      ...[...zones].reverse().map((z) => ({ key: selKey('zone', z.id), center: centroid(z.path_points), hit: (pt: Point) => pointInPolygon(pt, z.path_points) }))
    ];
  }

  async function applyMove(keys: string[], dx: number, dy: number, undo = false) {
    if (keys.length === 0 || (dx === 0 && dy === 0)) return;
    setSelBusy(true);
    const ids = (kind: SelKind) => new Set(keys.map(parseSel).filter((k) => k.kind === kind).map((k) => k.id));
    const placeIds = ids('place');
    const ops: PromiseLike<{ error: { message: string } | null }>[] = [];
    places.filter((p) => placeIds.has(p.id)).forEach((p) => {
      const n = shiftPoint(p, dx, dy);
      ops.push(supabase.from('map_places').update({ x: n.x, y: n.y }).eq('id', p.id));
    });
    const polys: [SelKind, { id: string; path_points: Point[] }[]][] = [['zone', zones], ['relief', relief], ['biome', biomes]];
    polys.forEach(([kind, list]) => {
      const set = ids(kind);
      list.filter((e) => set.has(e.id)).forEach((e) =>
        ops.push(supabase.from(SEL_TABLE[kind]).update({ path_points: shiftPoints(e.path_points, dx, dy) }).eq('id', e.id))
      );
    });
    // Les routes suivent leurs lieux : en entier si les deux bouts bougent,
    // sinon seul le bout attaché est déplacé.
    routes.forEach((r) => {
      const a = !!r.from_place_id && placeIds.has(r.from_place_id);
      const b = !!r.to_place_id && placeIds.has(r.to_place_id);
      if (!a && !b) return;
      const pts = r.path_points ?? [];
      const next = a && b ? shiftPoints(pts, dx, dy) : pts.map((pt, i) => ((a && i === 0) || (b && i === pts.length - 1) ? shiftPoint(pt, dx, dy) : pt));
      ops.push(supabase.from('map_routes').update({ path_points: next }).eq('id', r.id));
    });
    const results = await Promise.all(ops);
    setSelBusy(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) showToast(`Déplacement incomplet : ${failed.error.message}`, 'error');
    else showToast(undo ? 'Déplacement annulé.' : `${keys.length} élément${keys.length > 1 ? 's déplacés' : ' déplacé'}.`);
    setLastMove(undo || failed ? null : { keys, dx, dy });
    load();
  }

  async function deleteSelection() {
    if (sel.length === 0) return;
    const placeIds = new Set(sel.map(parseSel).filter((k) => k.kind === 'place').map((k) => k.id));
    const linked = routes.filter((r) => (!!r.from_place_id && placeIds.has(r.from_place_id)) || (!!r.to_place_id && placeIds.has(r.to_place_id))).length;
    const extra = linked > 0 ? ` ${linked} route${linked > 1 ? 's reliées à ces lieux sont concernées' : ' reliée à ces lieux est concernée'}.` : '';
    if (!confirm(`Supprimer définitivement ${sel.length} élément${sel.length > 1 ? 's' : ''} ?${extra}`)) return;
    setSelBusy(true);
    const byKind = new Map<SelKind, string[]>();
    sel.map(parseSel).forEach((k) => byKind.set(k.kind, [...(byKind.get(k.kind) ?? []), k.id]));
    const results = await Promise.all(Array.from(byKind.entries()).map(([kind, list]) => supabase.from(SEL_TABLE[kind]).delete().in('id', list)));
    setSelBusy(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) showToast(`Suppression incomplète : ${failed.error.message}`, 'error');
    else showToast(`${sel.length} élément${sel.length > 1 ? 's supprimés' : ' supprimé'}.`);
    setSel([]);
    setLastMove(null);
    load();
  }

  async function setSelectionTerritory(groupId: string | null) {
    setSelBusy(true);
    const results = await Promise.all(
      (['place', 'zone'] as SelKind[]).map((kind) => {
        const list = sel.map(parseSel).filter((k) => k.kind === kind).map((k) => k.id);
        return list.length ? supabase.from(SEL_TABLE[kind]).update({ controlling_group_id: groupId }).in('id', list) : Promise.resolve({ error: null });
      })
    );
    setSelBusy(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) showToast(`Territoire non modifié : ${failed.error.message}`, 'error');
    else showToast(groupId ? 'Territoire attribué à la sélection.' : 'Sélection rendue neutre.');
    load();
  }

  function selectRouteTool() {
    setDeleteMode(false);
    setActiveTool('route');
    setTempPoints([]);
    setDragBox(null);
    setFreehandPoints([]);
    setRouteDraft(null);
  }

  function toggleDeleteMode() {
    setDeleteMode((v) => !v);
    resetDrawing();
  }

  // Une suppression refusée (droits, réseau) échouait en silence tout en
  // annonçant « supprimé ».
  async function removeRow(table: string, id: string, okMessage: string) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return showToast(`Suppression impossible : ${error.message}`, 'error');
    showToast(okMessage);
    load();
  }
  async function deleteZone(z: MapZone) {
    if (!confirm(`Supprimer la zone "${z.name}" ? Les lieux qu'elle contient sont conservés.`)) return;
    await removeRow('map_zones', z.id, 'Zone supprimée.');
  }
  async function deletePlace(p: MapPlace) {
    const linked = routes.filter((r) => r.from_place_id === p.id || r.to_place_id === p.id).length;
    const extra = linked > 0 ? ` ${linked} route${linked > 1 ? 's' : ''} y ${linked > 1 ? 'sont reliées' : 'est reliée'}.` : '';
    if (!confirm(`Supprimer "${p.name}" ?${extra}`)) return;
    await removeRow('map_places', p.id, 'Lieu supprimé.');
  }
  async function deleteRoute(r: MapRoute) {
    if (!confirm(`Supprimer la route "${r.name || 'sans nom'}" ?`)) return;
    await removeRow('map_routes', r.id, 'Route supprimée.');
  }
  async function deleteRelief(r: MapRelief) {
    if (!confirm('Supprimer cette zone de relief ?')) return;
    await removeRow('map_relief', r.id, 'Relief supprimé.');
  }
  async function deleteBiome(b: MapBiome) {
    if (!confirm('Supprimer cette zone de biome ?')) return;
    await removeRow('map_biomes', b.id, 'Biome supprimé.');
  }

  function findPlaceNear(pt: Point): MapPlace | null {
    for (const p of places) {
      if (svgDistToScreenPx(pt, { x: p.x, y: p.y }) <= CLOSE_SNAP_PX) return p;
    }
    return null;
  }

  function handlePointerDown(e: React.PointerEvent) {
    vp.trackPointerDown(e);
    if (vp.isMultiTouch()) {
      // Un deuxième doigt vient de se poser : on annule tout tracé en
      // cours (le pincement prend le relais pour zoomer/naviguer).
      downRef.current = null;
      setDragBox(null);
      setFreehandPoints([]);
      setSelDrag(null);
      return;
    }

    downRef.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (!editMode || activeTool === null) {
      vp.startPan(e.clientX, e.clientY);
      return;
    }
    if (activeTool === 'select') {
      if (selBusy) return;
      const pt = vp.screenToSvg(e.clientX, e.clientY);
      const hit = selCandidates().find((c) => c.hit(pt))?.key ?? null;
      // Tirer un élément déjà sélectionné déplace tout le groupe ; sinon on trace un cadre.
      setSelDrag({ mode: hit && sel.includes(hit) ? 'move' : 'marquee', start: pt, cur: pt, hitKey: hit });
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
    if (vp.trackPointerMove(e)) return; // consommé par un pincement à 2 doigts

    if (vp.isPanning) {
      vp.doPan(e.clientX, e.clientY);
      return;
    }
    if (!editMode || !activeTool) return;
    if (selDrag) {
      const pt = vp.screenToSvg(e.clientX, e.clientY);
      setSelDrag((d) => (d ? { ...d, cur: pt } : d));
      return;
    }
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

  function handlePointerUp(e: React.PointerEvent) {
    vp.trackPointerUp(e);
    if (vp.isMultiTouch()) return; // il reste un doigt en pincement, on ignore

    const start = downRef.current;
    downRef.current = null;
    const moved = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 0;

    if (vp.isPanning) {
      vp.endPan();
      if (moved < 4) {
        if (measureMode) {
          const pt = vp.screenToSvg(e.clientX, e.clientY);
          // Un clic près d'un lieu s'y accroche ; un troisième clic recommence.
          const near = findPlaceNear(pt);
          const snapped = near ? { x: near.x, y: near.y } : pt;
          setMeasurePts((pts) => (pts.length >= 2 ? [snapped] : [...pts, snapped]));
        } else {
          const pt = vp.screenToSvg(e.clientX, e.clientY);
          if ((!editMode || envers.picking) && envers.onMapClick(e.clientX, e.clientY, pt, e.timeStamp)) return;
          setSelected(null);
        }
      }
      return;
    }

    if (!editMode || !activeTool) return;

    if (activeTool === 'select') {
      const d = selDrag;
      setSelDrag(null);
      if (!d) return;
      if (moved < 4) {
        // Simple clic : ajoute ou retire l'élément ; dans le vide, tout désélectionner.
        if (d.hitKey) setSel((cur) => (cur.includes(d.hitKey!) ? cur.filter((k) => k !== d.hitKey) : [...cur, d.hitKey!]));
        else setSel([]);
      } else if (d.mode === 'move') {
        applyMove(sel, Math.round((d.cur.x - d.start.x) * 100) / 100, Math.round((d.cur.y - d.start.y) * 100) / 100);
      } else {
        const x1 = Math.min(d.start.x, d.cur.x);
        const x2 = Math.max(d.start.x, d.cur.x);
        const y1 = Math.min(d.start.y, d.cur.y);
        const y2 = Math.max(d.start.y, d.cur.y);
        const inside = selCandidates().filter((c) => c.center.x >= x1 && c.center.x <= x2 && c.center.y >= y1 && c.center.y <= y2).map((c) => c.key);
        setSel((cur) => Array.from(new Set([...cur, ...inside])));
      }
      return;
    }

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
      return;
    }

    if (activeTool === 'route') {
      const nearbyPlace = findPlaceNear(pt);
      if (!routeDraft) {
        if (nearbyPlace) {
          setRouteDraft({ fromPlaceId: nearbyPlace.id, points: [{ x: nearbyPlace.x, y: nearbyPlace.y }] });
        } else {
          showToast(
            places.length < 2
              ? 'Une route relie deux lieux : place-en au moins deux avant de tracer.'
              : 'Une route part d’un lieu : clique sur le lieu de départ.',
            'info'
          );
        }
        return;
      }
      if (nearbyPlace && nearbyPlace.id !== routeDraft.fromPlaceId) {
        setFinalRoute({
          points: [...routeDraft.points, { x: nearbyPlace.x, y: nearbyPlace.y }],
          from: routeDraft.fromPlaceId,
          to: nearbyPlace.id
        });
        setRouteDraft(null);
        return;
      }
      if (!nearbyPlace) {
        setRouteDraft((d) => (d ? { ...d, points: [...d.points, pt] } : d));
      }
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

  // Emplacement du nom (et du drapeau) de chaque région : dans la région
  // elle-même, à l'écart des régions dessinées par-dessus. Les régions
  // sont peintes dans l'ordre de la liste : seules les suivantes recouvrent.
  const zoneAnchors = useMemo(() => {
    const m = new Map<string, { point: Point; clearance: number }>();
    zones.forEach((z, i) => {
      const above = zones.slice(i + 1).map((o) => o.path_points);
      const a = labelAnchor(z.path_points, above);
      if (a) m.set(z.id, a);
    });
    return m;
  }, [zones]);

  const showGrid = editMode && activeTool !== null;
  // Décalage d'aperçu pendant qu'on tire la sélection.
  const moveDx = selDrag?.mode === 'move' ? selDrag.cur.x - selDrag.start.x : 0;
  const moveDy = selDrag?.mode === 'move' ? selDrag.cur.y - selDrag.start.y : 0;
  const isSel = (kind: SelKind, id: string) => activeTool === 'select' && sel.includes(selKey(kind, id));
  const selShift = (kind: SelKind, id: string) => (isSel(kind, id) && (moveDx || moveDy) ? `translate(${moveDx} ${moveDy})` : undefined);
  const closeSnapReady = activeTool === 'polygon' && tempPoints.length >= 3;

  // Consigne du mode en cours (visible aussi sur téléphone, où l'ancienne
  // barre d'aide du bas était masquée).
  const layerName = editLayer === 'map' ? 'Carte' : editLayer === 'relief' ? 'Relief' : 'Biomes';
  const shapeMakes = editLayer === 'map' ? 'une région' : editLayer === 'relief' ? 'une zone de relief' : 'une zone de biome';
  // La mesure cède la place dès qu'un autre mode prend la main.
  useEffect(() => {
    if (editMode || flightMode) {
      setMeasureMode(false);
      setMeasurePts([]);
    }
  }, [editMode, flightMode]);

  // Plus petite taille de monde qui garde tout le contenu sur la carte.
  const minWorld = (() => {
    let max = 100;
    const see = (x: number, y: number) => {
      if (x > max) max = x;
      if (y > max) max = y;
    };
    places.forEach((p) => see(p.x + (p.radius ?? 3), p.y + (p.radius ?? 3)));
    [...zones, ...routes, ...biomes, ...relief].forEach((e) => (e.path_points ?? []).forEach((pt) => see(pt.x, pt.y)));
    return Math.min(1000, Math.ceil(max / 10) * 10);
  })();

  const measureKm = measurePts.length === 2 ? distanceUnits(measurePts[0], measurePts[1]) * mapSettings.settings.km_per_unit : null;
  const measureText = (() => {
    if (measureKm == null) return measurePts.length === 0 ? '📐 Mesure — clique le point de départ' : '📐 Mesure — clique le point d’arrivée';
    const walk = (measureKm / mapSettings.settings.walk_kmh) * 60;
    const mult = activeMountForFlight?.speed_multiplier ?? 1;
    const mounted = activeMountForFlight && mult !== 1 ? ` · ${formatMinutes(walk / mult)} avec ${activeMountForFlight.name}` : '';
    return `📐 ${formatDistance(measureKm, mapSettings.settings.unit_label)} à vol d’oiseau · ${formatMinutes(walk)} à pied${mounted}`;
  })();

  function locateMe() {
    if (!myPos?.place_id) return showToast('Ton personnage n’a pas encore de position : ouvre « Ma position ».', 'info');
    const moving = myPos.travel_started_at ? travelerScreenPosition(myPos, places, routes, Date.now()) : null;
    const here = moving ?? places.find((p) => p.id === myPos.place_id);
    if (!here) return showToast('Lieu introuvable sur la carte.', 'error');
    vp.panTo(here.x, here.y, 30);
  }

  const modeHint: string | null = measureMode
    ? measureText
    : flightMode
    ? flightTarget
      ? '🕊️ Vol libre — vérifie le trajet puis confirme'
      : '🕊️ Vol libre — clique le lieu de destination'
    : !editMode
    ? null
    : deleteMode
    ? editLayer === 'map'
      ? '🗑 Suppression — clique une région, un lieu ou une route'
      : `🗑 Suppression — clique une zone du calque ${layerName}`
    : activeTool === 'select'
    ? sel.length === 0
      ? '⬚ Sélection — clique des éléments, ou glisse pour les encadrer'
      : `⬚ ${sel.length} sélectionné${sel.length > 1 ? 's' : ''} — glisse l’un d’eux pour déplacer le groupe`
    : activeTool === 'polygon'
    ? tempPoints.length === 0
      ? `Polygone — clique pour poser le premier sommet (${shapeMakes})`
      : tempPoints.length < 3
      ? `Polygone — ${tempPoints.length} point${tempPoints.length > 1 ? 's' : ''}, il en faut au moins 3`
      : `Polygone — ${tempPoints.length} points · reclique le premier point ou « Terminer »`
    : activeTool === 'route'
    ? routeDraft
      ? `Route — ajoute des points de passage, puis clique le lieu d’arrivée`
      : 'Route — clique le lieu de départ'
    : activeTool === 'point-circle' || activeTool === 'point-rect'
    ? 'Lieu — clic simple (taille standard) ou clic-glisse (taille au choix)'
    : activeTool === 'freehand'
    ? `Tracé libre — dessine le contour de ${shapeMakes} sans lâcher`
    : activeTool
    ? `Clic-glisse pour dessiner ${shapeMakes}`
    : editLayer === 'map'
    ? 'Édition — choisis un outil : une forme (région), Lieu ou Route'
    : `Édition ${layerName} — choisis une forme, ou clique une zone pour changer sa texture`;

  const coachTip: CoachTip | null = (() => {
    if (loading || guide.tourRunning || modeHint || selected) return null;
    if (loadError)
      return {
        id: 'load-error',
        emoji: '⚠',
        tone: 'error',
        sticky: true,
        text: 'La carte n’a pas pu être chargée. Vérifie ta connexion, puis réessaie.',
        action: { label: 'Réessayer', run: load }
      };
    if (positionsHook.loading || permLoading) return null;
    if (myPos?.travel_started_at) {
      const trip = tripInfo(myPos, routes, now);
      const dest = places.find((p) => p.id === trip?.destinationId);
      const stop = trip && trip.legCount > 1 ? places.find((p) => p.id === trip.nextStopId) : null;
      const remaining = trip?.remainingMinutes ?? computeRemainingMinutes(myPos, now);
      return {
        id: 'traveling',
        emoji: myPos.flight_target_place_id ? '🕊️' : '🛣',
        sticky: true,
        text: `En voyage vers ${dest?.name ?? 'ta destination'} — ${remaining <= 0 ? 'arrivée imminente' : `arrivée dans ${formatMinutes(remaining)}`}${stop ? ` (prochaine étape : ${stop.name})` : ''}. Le trajet continue même page fermée.`,
        secondary: { label: 'Détails', run: () => setShowPositionPicker(true) }
      };
    }
    const tips: CoachTip[] = [];
    if (canEdit && places.length === 0 && zones.length === 0)
      tips.push({
        id: 'admin-empty',
        emoji: '🗺️',
        text: 'La carte est vide. Commence par régler l’échelle, puis dessine une première région.',
        action: { label: 'Ouvrir les outils', run: () => runApp('edit') },
        secondary: { label: 'Voir les étapes', run: () => guide.openHelp('start') }
      });
    if (!canEdit && places.length === 0)
      tips.push({
        id: 'player-empty',
        emoji: '🗺️',
        text: 'Aucun lieu n’a encore été publié sur la carte. Reviens quand les admins auront posé les premiers lieux.'
      });
    if (places.length > 0 && !myPos?.place_id)
      tips.push({
        id: 'no-position',
        emoji: '📍',
        text: 'Ton personnage n’est encore nulle part. Choisis son lieu de départ pour pouvoir voyager.',
        action: { label: 'Choisir mon lieu', run: () => setShowPositionPicker(true) }
      });
    if (canEdit && places.length >= 2 && routes.length === 0)
      tips.push({
        id: 'admin-no-routes',
        emoji: '🛣',
        text: 'Aucune route ne relie les lieux : à pied, les joueurs ne peuvent pas quitter leur lieu de départ.',
        action: {
          label: 'Tracer une route',
          run: () => {
            setToolbarOpen(true);
            setEditMode(true);
            setEditLayer('map');
            selectRouteTool();
          }
        }
      });
    if (myPos?.place_id && routes.length > 0 && !routes.some((r) => r.from_place_id === myPos.place_id || r.to_place_id === myPos.place_id) && !activeMountForFlight?.can_fly)
      tips.push({
        id: `stuck-${myPos.place_id}`,
        emoji: '🚧',
        text: 'Aucune route ne part du lieu où tu te trouves. Il te faut une monture volante, un cristal, ou qu’un admin trace une route.',
        secondary: { label: 'Comment voyager', run: () => guide.openHelp('topics') }
      });
    return tips.find((t) => !guide.state.dismissed.includes(t.id)) ?? null;
  })();


  // ---------------------------------------------------------------------
  // Calques mémorisés : ils ne sont redessinés que si leurs données ou la
  // sélection changent (pas à chaque tic d'horloge, ni pendant un geste).
  // Les clics passent par `act`, toujours à jour.
  // ---------------------------------------------------------------------
  const act = useRef({
    biome: (_e: React.MouseEvent, _b: MapBiome) => {},
    relief: (_e: React.MouseEvent, _r: MapRelief) => {},
    zone: (_e: React.MouseEvent, _z: MapZone) => {},
    route: (_e: React.MouseEvent, _r: MapRoute) => {},
    place: (_e: React.MouseEvent, _p: MapPlace) => {}
  });
  act.current = {
    biome: (e, b) => {
      if (editLayer !== 'biome') return;
      e.stopPropagation();
      if (deleteMode) deleteBiome(b);
      else if (editMode && !activeTool) setRetexture({ table: 'map_biomes', id: b.id, value: b.texture_id ?? null });
    },
    relief: (e, r) => {
      if (editLayer !== 'relief') return;
      e.stopPropagation();
      if (deleteMode) deleteRelief(r);
      else if (editMode && !activeTool) setRetexture({ table: 'map_relief', id: r.id, value: r.texture_id ?? null });
    },
    zone: (e, z) => {
      e.stopPropagation();
      if (deleteMode && editLayer === 'map') return deleteZone(z);
      if (!activeTool && !measureMode) setSelected({ kind: 'zone', entity: z });
    },
    route: (e, r) => {
      e.stopPropagation();
      if (deleteMode && editLayer === 'map') return deleteRoute(r);
      if (!activeTool && !measureMode) setSelectedRoute(r);
    },
    place: (e, p) => {
      e.stopPropagation();
      if (deleteMode && editLayer === 'map') return deletePlace(p);
      if (!activeTool) selectPlaceAndShare(p);
    }
  };
  const selSig = activeTool === 'select' ? sel.join(',') : '';
  const groupSig = groupsHook.groups.map((g) => `${g.id}:${g.label}`).join('|');
  const iconSig = placeTypes.items.map((i) => `${i.key}:${i.icon}`).join('|');

  const biomeLayer = useMemo(
    () =>
      showBiomes &&
      biomes.map((b) => (
        <polygon
          key={b.id}
          points={pointsToSvg(b.path_points)}
          fill={b.color}
          fillOpacity={showTextures && findTexture(biomeTextureId(b), customTextures)?.bg ? 0 : 0.55}
          stroke={isSel('biome', b.id) ? SEL : deleteMode && editLayer === 'biome' ? '#d2463b' : '#2e261d33'}
          strokeWidth={isSel('biome', b.id) ? 0.45 : deleteMode && editLayer === 'biome' ? 0.3 : 0.1}
          transform={selShift('biome', b.id)}
          className={editLayer === 'biome' ? 'cursor-pointer' : ''}
          onClick={(e) => act.current.biome(e, b)}
        />
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showBiomes, biomes, showTextures, customTextures, selSig, moveDx, moveDy, deleteMode, editLayer]
  );

  const reliefLayer = useMemo(
    () =>
      showRelief &&
      relief.map((r) => (
        <polygon
          key={r.id}
          points={pointsToSvg(r.path_points)}
          fill={reliefColor(r.elevation)}
          fillOpacity={showTextures && findTexture(reliefTextureId(r), customTextures)?.bg ? 0 : 0.4}
          stroke={isSel('relief', r.id) ? SEL : deleteMode && editLayer === 'relief' ? '#d2463b' : '#2e261d22'}
          strokeWidth={isSel('relief', r.id) ? 0.45 : deleteMode && editLayer === 'relief' ? 0.3 : 0.1}
          transform={selShift('relief', r.id)}
          className={editLayer === 'relief' ? 'cursor-pointer' : ''}
          onClick={(e) => act.current.relief(e, r)}
        />
      )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showRelief, relief, showTextures, customTextures, selSig, moveDx, moveDy, deleteMode, editLayer]
  );

  const textureLayer = useMemo(
    () =>
      showTextures && (
        <TextureOverlays biomes={biomes} relief={relief} custom={customTextures} showBiomes={showBiomes} showRelief={showRelief} />
      ),
    [showTextures, biomes, relief, customTextures, showBiomes, showRelief]
  );

  const zoneLayer = useMemo(
    () => (
      <>
        {/* Ombre côtière (sous les terres), comme le lavis bleu des vieux atlas. */}
        <g style={{ pointerEvents: 'none' }}>
          {zones.map((z) => (
            <polygon key={`coast-${z.id}`} points={pointsToSvg(z.path_points)} fill="none" stroke={COAST} strokeOpacity={0.4} strokeWidth={2.4} strokeLinejoin="round" transform={selShift('zone', z.id)} />
          ))}
          {zones.map((z) => (
            <polygon key={`coast2-${z.id}`} points={pointsToSvg(z.path_points)} fill="none" stroke={COAST} strokeOpacity={0.35} strokeWidth={0.9} strokeLinejoin="round" transform={selShift('zone', z.id)} />
          ))}
          {zones.map((z) => (
            <polygon key={`land-${z.id}`} points={pointsToSvg(z.path_points)} fill={VELLUM} transform={selShift('zone', z.id)} />
          ))}
        </g>
        {zones.map((z) => (
          <polygon
            key={z.id}
            points={pointsToSvg(z.path_points)}
            fill={z.color}
            fillOpacity={0.4}
            stroke={isSel('zone', z.id) ? SEL : deleteMode ? '#d2463b' : INK}
            strokeOpacity={isSel('zone', z.id) || deleteMode ? 1 : 0.62}
            strokeWidth={isSel('zone', z.id) ? 0.45 : deleteMode ? 0.3 : 0.16}
            strokeLinejoin="round"
            strokeDasharray={isSel('zone', z.id) ? '1.2 0.6' : undefined}
            transform={selShift('zone', z.id)}
            className="zone-poly cursor-pointer"
            onClick={(e) => act.current.zone(e, z)}
          />
        ))}
        <g style={{ pointerEvents: 'none' }}>
          {zones.map((z) => (
            <polygon key={`hatch-${z.id}`} points={pointsToSvg(z.path_points)} fill="url(#sid-hatch)" transform={selShift('zone', z.id)} />
          ))}
        </g>
        {zones.map((z) => {
          const label = groupsHook.labelFor(z.controlling_group_id);
          if (!label) return null;
          const c = zoneAnchors.get(z.id)?.point ?? centroid(z.path_points);
          return <TerritoryFlag key={`flag-${z.id}`} x={c.x} y={c.y} label={label} />;
        })}
        {/* Nom des régions, en lettres espacées comme sur un atlas. */}
        {zones.map((z) => {
          if (!z.name || z.path_points.length < 3) return null;
          // Région entièrement recouverte par d'autres : pas de nom plutôt qu'un nom mal placé.
          const anchor = zoneAnchors.get(z.id);
          if (!anchor) return null;
          const xs = z.path_points.map((p) => p.x);
          const width = Math.max(...xs) - Math.min(...xs);
          // Le texte doit tenir dans l'espace libre autour du point d'ancrage.
          const fit = (anchor.clearance * 2.6) / Math.max(4, z.name.length);
          const size = Math.max(0.9, Math.min(3.2, (width * 0.7) / Math.max(4, z.name.length), fit));
          const c = anchor.point;
          const flag = !!groupsHook.labelFor(z.controlling_group_id);
          return (
            <text
              key={`name-${z.id}`}
              x={c.x}
              y={c.y + (flag ? size * 2.2 : size * 0.35)}
              textAnchor="middle"
              fontSize={size}
              letterSpacing={size * 0.22}
              fill={INK}
              fillOpacity={0.78}
              className="region-label select-none"
              style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: VELLUM, strokeOpacity: 0.7, strokeWidth: size * 0.14 }}
              transform={selShift('zone', z.id)}
            >
              {z.name}
            </text>
          );
        })}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zones, zoneAnchors, groupSig, selSig, moveDx, moveDy, deleteMode]
  );

  const routeLayer = useMemo(
    () =>
      routes.map((r) => {
        const isHighlighted = highlightedPlan?.steps.some((s) => s.route.id === r.id);
        return (
          <polyline
            key={r.id}
            points={pointsToSvg(r.path_points)}
            fill="none"
            stroke={deleteMode ? '#d2463b' : isHighlighted ? SEL : !r.color || r.color.toLowerCase() === DEFAULT_ROUTE ? SANGUINE : r.color}
            strokeWidth={isHighlighted ? 0.6 : 0.32}
            strokeDasharray={isHighlighted ? undefined : '1.1 0.7'}
            strokeLinecap="round"
            className={`cursor-pointer ${isHighlighted ? 'route-glow' : 'route-flow'}`}
            onClick={(e) => act.current.route(e, r)}
          />
        );
      }),
    [routes, highlightedPlan, deleteMode]
  );

  const placeLayer = useMemo(
    () => (
      <>
        {places.map((p) => {
          const r = p.radius ?? 3;
          const w = p.width ?? r * 2;
          const h = p.height ?? r * 2;
          const iconSize = p.shape === 'rect' ? Math.min(w, h) * 0.4 : r * 0.85;
          const labelOffset = (p.shape === 'rect' ? h / 2 : r) + 2;
          const icon = p.icon || placeTypes.iconFor(p.type);
          // Image importée : dessinée dans le rond, un peu plus grande qu'un emoji.
          const s = iconSize * 1.55;
          return (
            <g
              key={p.id}
              transform={`translate(${p.x + (isSel('place', p.id) ? moveDx : 0)}, ${p.y + (isSel('place', p.id) ? moveDy : 0)})`}
              className="map-place cursor-pointer"
              onClick={(e) => act.current.place(e, p)}
            >
              {p.shape === 'rect' ? (
                <>
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.5} fill="#f6eedb" stroke={deleteMode ? '#d2463b' : INK} strokeWidth={deleteMode ? 0.35 : 0.2} className="place-disc" />
                  <rect x={-w / 2 + 0.45} y={-h / 2 + 0.45} width={w - 0.9} height={h - 0.9} rx={0.3} fill="none" stroke={INK} strokeOpacity={0.45} strokeWidth={0.07} />
                </>
              ) : (
                <>
                  <circle r={r} fill="#f6eedb" stroke={deleteMode ? '#d2463b' : INK} strokeWidth={deleteMode ? 0.35 : 0.2} className="place-disc" />
                  <circle r={Math.max(0.2, r - 0.45)} fill="none" stroke={INK} strokeOpacity={0.45} strokeWidth={0.07} />
                </>
              )}
              {isSel('place', p.id) &&
                (p.shape === 'rect' ? (
                  <rect x={-w / 2 - 0.7} y={-h / 2 - 0.7} width={w + 1.4} height={h + 1.4} rx={1} fill="none" stroke={SEL} strokeWidth={0.3} strokeDasharray="1 0.6" className="sel-ring" />
                ) : (
                  <circle r={r + 0.8} fill="none" stroke={SEL} strokeWidth={0.3} strokeDasharray="1 0.6" className="sel-ring" />
                ))}
              {isImageIcon(icon) ? (
                <image href={icon} x={-s / 2} y={-s / 2} width={s} height={s} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: 'none' }} />
              ) : (
                <text textAnchor="middle" dy={iconSize * 0.35} fontSize={iconSize} fill={INK}>
                  {icon}
                </text>
              )}
              <text
                textAnchor="middle"
                dy={labelOffset}
                fontSize="1.35"
                fontWeight={700}
                fill={INK}
                className="place-label select-none"
                style={{ paintOrder: 'stroke', stroke: VELLUM, strokeOpacity: 0.92, strokeWidth: 0.42, strokeLinejoin: 'round' }}
              >
                {p.name}
              </text>
            </g>
          );
        })}
        {places.map((p) => {
          const label = groupsHook.labelFor(p.controlling_group_id);
          if (!label) return null;
          const offset = (p.shape === 'rect' ? (p.height ?? 6) / 2 : p.radius ?? 3) + 4;
          return <TerritoryFlag key={`flag-${p.id}`} x={p.x} y={p.y - offset} label={label} />;
        })}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, iconSig, groupSig, selSig, moveDx, moveDy, deleteMode]
  );

  // Page de la carte : l'aurore animée du fond est inutile (cachée par la
  // carte) et coûteuse sur téléphone.
  useEffect(() => {
    document.documentElement.classList.add('map-page');
    return () => document.documentElement.classList.remove('map-page');
  }, []);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden">
      <Navbar />
      <div className="relative flex-1 overflow-hidden">
      {canEdit && (
        <div data-guide="edit-toolbar" className="fixed inset-x-2 bottom-2 z-20 max-w-full md:absolute md:inset-x-auto md:bottom-auto md:left-4 md:top-6 md:max-w-[calc(100%-2rem)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
                    <div className="flex shrink-0 gap-1 rounded-lg border border-white/15 bg-white/5 p-0.5">
                      {(['map', 'relief', 'biome'] as const).map((layer) => (
                        <button
                          key={layer}
                          onClick={() => {
                            setEditLayer(layer);
                            resetDrawing();
                            setDeleteMode(false);
                            if (layer === 'relief') setShowRelief(true);
                            if (layer === 'biome') setShowBiomes(true);
                          }}
                          className={`whitespace-nowrap rounded px-2 py-1.5 font-display text-xs transition ${
                            editLayer === layer ? 'bg-accent text-paper' : 'text-paper/60 hover:text-paper'
                          }`}
                        >
                          <GlyphText text={layer === 'map' ? '🗺️ Carte' : layer === 'relief' ? '🏔 Relief' : '🌿 Biomes'} />
                        </button>
                      ))}
                    </div>

                    {editLayer === 'map' && (
                      <>
                        <button
                          onClick={() => selectPointTool('point-circle')}
                          className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-2 font-display text-xs transition ${
                            activeTool === 'point-circle'
                              ? 'btn-accent border-transparent text-paper'
                              : 'border-white/15 bg-white/5 text-paper/70'
                          }`}
                        >
                          ⚬ Lieu (rond)
                        </button>
                        <button
                          onClick={() => selectPointTool('point-rect')}
                          className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-2 font-display text-xs transition ${
                            activeTool === 'point-rect'
                              ? 'btn-accent border-transparent text-paper'
                              : 'border-white/15 bg-white/5 text-paper/70'
                          }`}
                        >
                          ▭ Lieu (rectangle)
                        </button>
                        <button
                          onClick={selectRouteTool}
                          className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-2 font-display text-xs transition ${
                            activeTool === 'route'
                              ? 'btn-accent border-transparent text-paper'
                              : 'border-white/15 bg-white/5 text-paper/70'
                          }`}
                        >
                          <SidIcon name="road" /> Route
                        </button>
                      </>
                    )}
                    <button
                      onClick={selectSelectTool}
                      className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-2 font-display text-xs transition ${
                        activeTool === 'select' ? 'btn-accent border-transparent text-paper' : 'border-white/15 bg-white/5 text-paper/70'
                      }`}
                    >
                      ⬚ Sélection
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
                    activeTool && activeTool !== 'point-circle' && activeTool !== 'point-rect' && activeTool !== 'route' && activeTool !== 'select'
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

              {activeTool === 'select' && (
                <div className="anim-fade flex items-center gap-1.5 overflow-x-auto border-t border-white/10 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-[#e7c34a]/15 px-2.5 py-1 text-[11px] text-[#e7c34a]">
                    {sel.length} sélectionné{sel.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setSel(selCandidates().map((c) => c.key))}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-paper/75 hover:border-accent hover:text-accent"
                  >
                    Tout
                  </button>
                  <button
                    onClick={() => setSel([])}
                    disabled={sel.length === 0}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-paper/75 hover:border-accent hover:text-accent disabled:opacity-30"
                  >
                    Aucun
                  </button>
                  {editLayer === 'map' && (
                    <select
                      value=""
                      disabled={sel.length === 0 || selBusy}
                      onChange={(e) => {
                        if (e.target.value) setSelectionTerritory(e.target.value === 'none' ? null : e.target.value);
                      }}
                      style={{ colorScheme: 'dark' }}
                      aria-label="Attribuer un territoire à la sélection"
                      className="glass-input shrink-0 rounded-lg px-2 py-1.5 text-xs text-paper/80 disabled:opacity-30"
                    >
                      <option value=""><SidIcon name="flag" /> Territoire…</option>
                      <option value="none">Aucun (neutre)</option>
                      {groupsHook.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={deleteSelection}
                    disabled={sel.length === 0 || selBusy}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-xs text-accent disabled:opacity-30"
                  >
                    <SidIcon name="trash" /> Supprimer
                  </button>
                  {lastMove && (
                    <button
                      onClick={() => applyMove(lastMove.keys, -lastMove.dx, -lastMove.dy, true)}
                      disabled={selBusy}
                      className="shrink-0 whitespace-nowrap rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-paper/75 hover:border-accent hover:text-accent disabled:opacity-30"
                    >
                      ↶ Annuler le déplacement
                    </button>
                  )}
                </div>
              )}

              {deleteMode && (
                <p className="max-w-xs text-[11px] text-accent/90">
                  Seul le calque {layerName} est concerné. Chaque suppression demande confirmation et est définitive.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <ScaleBar
        svgRef={vp.svgRef}
        viewBoxW={vp.viewBox.w}
        settings={mapSettings.settings}
        canEdit={canEdit}
        onSave={mapSettings.save}
        minWorld={minWorld}
      />

      <div data-guide="zoom" className="absolute right-4 top-6 z-20">
        <ZoomControls onZoomIn={vp.zoomIn} onZoomOut={vp.zoomOut} onReset={vp.resetView} onLocate={locateMe} />
      </div>

      {loading && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
          <span aria-hidden className="compass-spin text-3xl"><SidIcon name="compass" /></span>
          <p className="font-display text-xs uppercase tracking-widest2 text-paper/60">Chargement de la carte…</p>
        </div>
      )}

      <div aria-hidden className="map-vignette pointer-events-none absolute inset-0 z-[5]" />
      <svg
        ref={vp.svgRef}
        viewBox={vp.viewBoxString}
        style={{ touchAction: 'none', transformOrigin: '0 0' }}
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
        data-envers-map=""
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (vp.isPanning) vp.endPan();
        }}
      >
        <defs>
          {/* Mer : petites ondes à la plume. */}
          <pattern id="sid-waves" width={4.2} height={2.6} patternUnits="userSpaceOnUse">
            <path d="M0 1.3 q1.05 -0.9 2.1 0 t2.1 0" fill="none" stroke="#4f7d7a" strokeOpacity={0.3} strokeWidth={0.09} />
          </pattern>
          {/* Hachures fines sur les terres. */}
          <pattern id="sid-hatch" width={1.2} height={1.2} patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
            <path d="M0 0V1.2" stroke={INK} strokeOpacity={0.07} strokeWidth={0.18} />
          </pattern>
          <pattern id="sid-graticule" width={world / 10} height={world / 10} patternUnits="userSpaceOnUse">
            <path d={`M${world / 10} 0H0V${world / 10}`} fill="none" stroke={INK} strokeOpacity={0.12} strokeWidth={0.08} />
          </pattern>
        </defs>
        {/* Hors du monde : la table (le fond de la page). La feuille de vélin
            déborde un peu autour du monde, avec son filet en damier. */}
        <rect x={-world * 2} y={-world * 2} width={world * 5} height={world * 5} fill="#161d2b" />
        {(() => {
          const m = world * 0.045; // marge de la feuille
          const b = world * 0.011; // largeur du filet en damier
          const seg = world / 40;
          const cells = [];
          for (let k = 0; k < 40; k++) {
            if (k % 2) continue;
            const o = k * seg;
            cells.push(<rect key={`t${k}`} x={o} y={-b} width={seg} height={b} />, <rect key={`b${k}`} x={o} y={world} width={seg} height={b} />);
            cells.push(<rect key={`l${k}`} x={-b} y={world - o - seg} width={b} height={seg} />, <rect key={`r${k}`} x={world} y={world - o - seg} width={b} height={seg} />);
          }
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={-m} y={-m} width={world + 2 * m} height={world + 2 * m} fill="#e4d6b4" />
              <rect x={-m} y={-m} width={world + 2 * m} height={world + 2 * m} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={world * 0.004} />
              <rect x={0} y={0} width={world} height={world} fill={SEA} />
              <rect x={0} y={0} width={world} height={world} fill="url(#sid-waves)" />
              <rect x={0} y={0} width={world} height={world} fill="url(#sid-graticule)" />
              <rect x={-b} y={-b} width={world + 2 * b} height={world + 2 * b} fill="none" stroke={INK} strokeWidth={b * 0.12} />
              <g fill={INK}>{cells}</g>
              <rect x={0} y={0} width={world} height={world} fill="none" stroke={INK} strokeWidth={b * 0.16} />
            </g>
          );
        })()}

        {/* Rose des vents, dans l'angle bas-droit du monde. */}
        <g transform={`translate(${world - 11} ${world - 11})`} style={{ pointerEvents: 'none' }}>
          <circle r={6.4} fill={VELLUM} fillOpacity={0.75} stroke={INK} strokeWidth={0.14} />
          <circle r={5.2} fill="none" stroke={INK} strokeOpacity={0.6} strokeWidth={0.07} strokeDasharray="0.35 0.35" />
          {[45, 135, 225, 315].map((a) => (
            <path key={a} d="M0 -3.6 L0.6 0 L-0.6 0 Z" fill={INK} fillOpacity={0.55} transform={`rotate(${a})`} />
          ))}
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <path d="M0 -5.8 L1 0 L0 0 Z" fill={a === 0 ? SANGUINE : INK} />
              <path d="M0 -5.8 L-1 0 L0 0 Z" fill={a === 0 ? '#c46a52' : '#6b5d4b'} />
            </g>
          ))}
          <circle r={0.45} fill={VELLUM} stroke={INK} strokeWidth={0.1} />
          <text y={-6.9} textAnchor="middle" fontSize={1.6} fill={INK} className="region-label">N</text>
        </g>

        {biomeLayer}
        {reliefLayer}
        {textureLayer}

        {zoneLayer}

        {showGrid && <GridOverlay viewBox={vp.viewBox} />}

        {routeLayer}

        {routeDraft && (
          <polyline
            points={pointsToSvg(routeDraft.points)}
            fill="none"
            stroke={SEL}
            strokeWidth={0.35}
            strokeDasharray="1 0.7"
          />
        )}

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
                fill={i === 0 && closeSnapReady ? '#d2463b' : INK}
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

        {placeLayer}

        {selDrag?.mode === 'marquee' && (
          <rect
            x={Math.min(selDrag.start.x, selDrag.cur.x)}
            y={Math.min(selDrag.start.y, selDrag.cur.y)}
            width={Math.abs(selDrag.cur.x - selDrag.start.x)}
            height={Math.abs(selDrag.cur.y - selDrag.start.y)}
            fill={SEL}
            fillOpacity={0.08}
            stroke={SEL}
            strokeWidth={Math.max(0.1, vp.viewBox.w * 0.0015)}
            strokeDasharray="1 0.6"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {measureMode && measurePts.length > 0 && (
          <g style={{ pointerEvents: 'none' }}>
            {measurePts.length === 2 && (
              <line
                x1={measurePts[0].x}
                y1={measurePts[0].y}
                x2={measurePts[1].x}
                y2={measurePts[1].y}
                stroke={SEL}
                strokeWidth={0.35}
                strokeDasharray="1 0.6"
                strokeLinecap="round"
              />
            )}
            {measurePts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={0.7} fill={VELLUM} stroke={SEL} strokeWidth={0.25} />
            ))}
          </g>
        )}

        <QuestMarkers quests={quests} places={places} openPlaceId={openQuestPlace} onToggle={(id) => setOpenQuestPlace((c) => (c === id ? null : id))} />

        {flightMode && flightTarget && myPlaceForFlight && (
          <line
            x1={myPlaceForFlight.x}
            y1={myPlaceForFlight.y}
            x2={flightTarget.x}
            y2={flightTarget.y}
            stroke={SEL}
            strokeWidth={0.4}
            strokeDasharray="1.2 1"
            strokeLinecap="round"
            style={{ pointerEvents: 'none' }}
          />
        )}

        <PresenceMarkers positions={positionsHook.positions} places={places} routes={routes} openGroup={openPresenceId} onToggle={(id) => setOpenPresenceId((c) => (c === id ? null : id))} />
      </svg>

      {openPresenceId && (
        <div className="glass-strong absolute bottom-20 right-3 z-30 w-56 max-w-[calc(100%-1.5rem)] rounded-xl p-3 text-xs text-paper md:bottom-6">
          <div className="mb-1 flex items-center justify-between">
            <p className="font-semibold text-accent">
              <SidIcon name="profile" /> {places.find((p) => p.id === openPresenceId)?.name ?? 'Lieu'}
            </p>
            <button onClick={() => setOpenPresenceId(null)} className="text-paper/65 hover:text-accent">
              ✕
            </button>
          </div>
          {positionsHook.positions
            .filter((p) => p.place_id === openPresenceId && !p.travel_started_at)
            .map((p) => (
              <p key={p.user_id} className="truncate">
                {p.nickname ?? 'Membre'}
                {p.status && <span className="text-paper/65"> — {p.status}</span>}
              </p>
            ))}
        </div>
      )}

      {openQuestPlace && places.find((p) => p.id === openQuestPlace) && quests.some((q) => q.place_id === openQuestPlace) && (
        <QuestPopup
          place={places.find((p) => p.id === openQuestPlace)!}
          quests={quests.filter((q) => q.place_id === openQuestPlace)}
          myPos={myPos}
          myUserId={positionsHook.myUserId}
          onClose={() => setOpenQuestPlace(null)}
          onToast={(m, k) => showToast(m, k)}
          onGo={(id) => {
            setOpenQuestPlace(null);
            setPlannerTo(id);
            setPlannerKey((k) => k + 1);
            setShowPlanner(true);
          }}
        />
      )}

      {selected && (
        <DetailPanel
          entity={selected.entity}
          kind={selected.kind}
          onClose={() => setSelected(null)}
          onDeleted={load}
          positionsHook={positionsHook}
          isFavorite={favorites.has(selected.entity.id)}
          onToggleFavorite={() => favorites.toggle(selected.entity.id)}
          onGoHere={(id) => {
            setPlannerTo(id);
            setPlannerKey((k) => k + 1);
            setShowPlanner(true);
            setSelected(null);
          }}
        />
      )}

      {finalPoints && editLayer === 'map' && (
        <ZoneFormModal
          points={finalPoints}
          onClose={resetDrawing}
          onSaved={() => {
            resetDrawing();
            load();
          }}
        />
      )}

      {finalPoints && editLayer === 'relief' && (
        <ReliefFormModal
          points={finalPoints}
          onClose={resetDrawing}
          onSaved={() => {
            resetDrawing();
            load();
          }}
        />
      )}

      {finalPoints && editLayer === 'biome' && (
        <BiomeFormModal
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

      {finalRoute && (
        <RouteFormModal
          pathPoints={finalRoute.points}
          fromPlaceId={finalRoute.from}
          toPlaceId={finalRoute.to}
          onClose={resetDrawing}
          onSaved={() => {
            resetDrawing();
            load();
          }}
        />
      )}

      {selectedRoute && (
        <RouteInfoModal
          route={selectedRoute}
          places={places}
          onClose={() => setSelectedRoute(null)}
          onDeleted={load}
        />
      )}

      {retexture && (
        <Modal title="Changer la texture" onClose={() => setRetexture(null)} maxWidth="max-w-sm">
          <TexturePicker
            value={retexture.value}
            onChange={async (v) => {
              const { error } = await supabase.from(retexture.table).update({ texture_id: v }).eq('id', retexture.id);
              if (error) return showToast(`Texture non enregistrée : ${error.message}`, 'error');
              setRetexture(null);
              load();
            }}
          />
        </Modal>
      )}

      {modeHint && (
        <div
          role="status"
          className="anim-drop glass-strong absolute left-1/2 top-36 z-20 md:bottom-3 md:top-auto flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-2xl px-3.5 py-2 text-xs text-paper/90"
        >
          <span className="min-w-0"><GlyphText text={modeHint} /></span>
          {measureMode ? (
            <button
              onClick={() => {
                setMeasureMode(false);
                setMeasurePts([]);
              }}
              className="shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 text-paper/70 hover:text-accent"
            >
              Quitter
            </button>
          ) : flightMode ? (
            <button
              onClick={() => {
                setFlightMode(false);
                setFlightTarget(null);
              }}
              className="shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 text-paper/70 hover:text-accent"
            >
              Quitter
            </button>
          ) : deleteMode ? (
            <button onClick={toggleDeleteMode} className="shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 text-paper/70 hover:text-accent">
              Désactiver
            </button>
          ) : activeTool ? (
            <button onClick={resetDrawing} className="shrink-0 rounded-full border border-white/20 px-2.5 py-0.5 text-paper/70 hover:text-accent">
              Annuler
            </button>
          ) : null}
        </div>
      )}

      <MapCoach tip={coachTip} onDismiss={guide.dismiss} />

      {flightMode && flightTarget && myPlaceForFlight && activeMountForFlight && (
        <FlightPanel
          from={myPlaceForFlight}
          to={flightTarget}
          mount={activeMountForFlight}
          settings={mapSettings.settings}
          biomes={biomes}
          busy={flightBusy}
          onConfirm={confirmFlight}
          onCancel={() => setFlightTarget(null)}
        />
      )}

      {showLayers && (
        <Modal title="🗂️ Calques" windowId="layers" onClose={() => setShowLayers(false)} maxWidth="max-w-xs">
          <div className="space-y-2">
            {[
              { label: '🏔 Relief', v: showRelief, set: setShowRelief },
              { label: '🌿 Biomes', v: showBiomes, set: setShowBiomes },
              { label: '🎨 Textures', v: showTextures, set: setShowTextures }
            ].map((l) => (
              <label key={l.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-paper/80">
                <span><GlyphText text={l.label} /></span>
                <input type="checkbox" checked={l.v} onChange={(e) => l.set(e.target.checked)} className="h-4 w-4 accent-[#d2463b]" />
              </label>
            ))}
          </div>
        </Modal>
      )}

      {showBlackMarkets && (
        <Modal title="🕶️ Marchés noirs" windowId="blackmarket" onClose={() => setShowBlackMarkets(false)} maxWidth="max-w-xs">
          <div className="space-y-1.5">
            {places.filter((p) => p.allows_black_market).length === 0 && (
              <p className="text-xs text-paper/65">Aucun lieu n'autorise de marché noir pour l'instant.</p>
            )}
            {places
              .filter((p) => p.allows_black_market)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setShowBlackMarkets(false);
                    selectPlaceAndShare(p);
                  }}
                  className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-paper/80 hover:border-accent"
                >
                  <Icon value={p.icon ?? '📍'} /> {p.name}
                </button>
              ))}
          </div>
        </Modal>
      )}

      {showMounts && (
        <MountsModal settings={mapSettings.settings} myPosition={positionsHook.myPosition} onClose={() => setShowMounts(false)} />
      )}

      {showCrystals && (
        <CrystalsModal places={places} positionsHook={positionsHook} onClose={() => setShowCrystals(false)} />
      )}

      {showPositionPicker && (
        <PositionPickerModal
          settings={mapSettings.settings}
          biomes={biomes}
          places={places}
          routes={routes}
          positionsHook={positionsHook}
          onClose={() => setShowPositionPicker(false)}
        />
      )}

      <MapActionStack raised={canEdit && toolbarOpen && editMode}>
        <div data-guide="layers" className="glass flex gap-1 rounded-full p-1">
          <button
            onClick={() => setShowRelief((v) => !v)}
            className={`rounded-full px-2.5 py-1 font-display text-[10px] uppercase tracking-wide transition ${
              showRelief ? 'bg-accent text-paper' : 'text-paper/60'
            }`}
          >
            <SidIcon name="mountain" /> Relief
          </button>
          <button
            onClick={() => setShowBiomes((v) => !v)}
            className={`rounded-full px-2.5 py-1 font-display text-[10px] uppercase tracking-wide transition ${
              showBiomes ? 'bg-accent text-paper' : 'text-paper/60'
            }`}
          >
            <SidIcon name="muguet" /> Biomes
          </button>
          <button
            onClick={() => setShowTextures((v) => !v)}
            className={`rounded-full px-2.5 py-1 font-display text-[10px] uppercase tracking-wide transition ${
              showTextures ? 'bg-accent text-paper' : 'text-paper/60'
            }`}
          >
            <SidIcon name="palette" /> Textures
          </button>
        </div>
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
        <div data-guide="presence">
          <PresencePanel
            positions={positionsHook.positions}
            places={places}
            routes={routes}
            onFocusPlace={(placeId) => {
              const p = places.find((pl) => pl.id === placeId);
              if (p) selectPlaceAndShare(p);
            }}
          />
        </div>
      </MapActionStack>

      {extraApps.includes('directory') && (
        <DirectoryApp
          places={places}
          positions={positionsHook.positions}
          favoriteIds={favorites.ids}
          typeLabel={placeTypes.labelFor}
          typeIcon={placeTypes.iconFor}
          onGo={selectPlaceAndShare}
          onClose={() => closeExtra('directory')}
        />
      )}
      {extraApps.includes('nearby') && (
        <NearbyApp
          places={places}
          routes={routes}
          myPlaceId={myPos?.place_id ?? null}
          settings={mapSettings.settings}
          speedMultiplier={activeMountForFlight?.speed_multiplier ?? 1}
          onGo={selectPlaceAndShare}
          onOpenPosition={() => {
            closeExtra('nearby');
            setShowPositionPicker(true);
          }}
          onClose={() => closeExtra('nearby')}
        />
      )}
      {extraApps.includes('notes') && <NotesApp currentPlaceName={places.find((p) => p.id === myPos?.place_id)?.name ?? null} onClose={() => closeExtra('notes')} />}

      {showPlanner &&
        (isDesktop ? (
          <Modal
            title="🧭 Itinéraire"
            windowId="itinerary"
            maxWidth="max-w-xs"
            onClose={() => {
              setHighlightedPlan(null);
              setShowPlanner(false);
            }}
          >
            <RoutePlannerPanel bare key={plannerKey} {...plannerProps} />
          </Modal>
        ) : (
          <div className="absolute bottom-40 right-4 z-20">
            <RoutePlannerPanel key={plannerKey} {...plannerProps} />
          </div>
        ))}

      <div data-guide="search" className="absolute left-1/2 top-6 z-20 -translate-x-1/2">
        <PlaceSearch places={places} onSelect={selectPlaceAndShare} favoriteIds={favorites.ids} />
      </div>

      {(() => {
        if (!myPos?.place_id || !myPos.arrived_at || myPos.travel_started_at) return null;
        const questHere = quests.find((q) => q.place_id === myPos.place_id);
        if (!questHere) return null;
        const elapsedMin = (now - new Date(myPos.arrived_at).getTime()) / 60000;
        if (elapsedMin >= 60) return null;
        const remaining = Math.ceil(60 - elapsedMin);
        return (
          <div className="glass absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full px-4 py-1.5 font-display text-[10px] uppercase tracking-wide text-accent md:bottom-16">
            <SidIcon name="scroll" /> Quête "{questHere.title}" — présence confirmée dans {remaining} min
          </div>
        );
      })()}

      {!modeHint && (
        <div className="glass absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 rounded-full px-4 py-1.5 font-display text-[10px] uppercase tracking-wide text-paper/60 md:block">
          Glisse pour naviguer · molette pour zoomer · clique un élément pour l'explorer
        </div>
      )}
      </div>
      {envers.layer}
    </div>
  );
}
