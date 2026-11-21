import type { MapBiome, MapPlace, MapRoute, Point } from './types';
import { routeWeight } from './pathfinding';

/** Météo des biomes (migration 0119). */
export type WeatherKind =
  | 'clair' | 'nuageux' | 'vent' | 'pluie' | 'brouillard' | 'orage'
  | 'neige' | 'blizzard' | 'canicule' | 'tempete_sable' | 'cendres';

export type WeatherNow = {
  enabled: boolean;
  changes_at: string;
  kinds: Record<string, { label: string; factor: number }>;
  biomes: { id: string; biome_type: string; kind: WeatherKind; next: WeatherKind; forced_until: string | null }[];
  /** Lieux qui ont leurs propres règles (migration 0120). */
  places?: PlaceWeather[];
};

export type PlaceWeather = {
  id: string;
  kind: WeatherKind;
  next: WeatherKind;
  fixed_kind: WeatherKind | null;
  forbidden: WeatherKind[];
  weights: Partial<Record<WeatherKind, number>> | null;
};

export const WEATHER_KINDS: WeatherKind[] = [
  'clair', 'nuageux', 'vent', 'pluie', 'brouillard', 'orage', 'neige', 'blizzard', 'canicule', 'tempete_sable', 'cendres',
];

/** Pire temps des biomes qui contiennent un point (même règle que _point_biome_weather). */
export function pointBiomeWeather(x: number, y: number, biomes: MapBiome[], weather: WeatherNow): { kind: string; factor: number } | null {
  const byId = new Map(weather.biomes.map((b) => [b.id, b.kind]));
  let best: { kind: string; factor: number } | null = null;
  for (const b of biomes) {
    if (b.is_published === false || b.path_points.length < 3) continue;
    const kind = byId.get(b.id);
    if (!kind || !inPoly(x, y, b.path_points)) continue;
    const factor = weather.kinds[kind]?.factor ?? 1;
    if (!best || factor > best.factor) best = { kind, factor };
  }
  return best;
}

/** Temps d'un lieu : ses règles s'il en a, sinon celui de son biome. */
export function placeWeather(place: Pick<MapPlace, 'id' | 'x' | 'y'>, biomes: MapBiome[], weather: WeatherNow | null): { kind: string; next: string | null; own: boolean } | null {
  if (!weather?.enabled) return null;
  const own = weather.places?.find((p) => p.id === place.id);
  if (own) return { kind: own.kind, next: own.next, own: true };
  const byId = new Map(weather.biomes.map((b) => [b.id, b]));
  let best: { kind: string; next: string; factor: number } | null = null;
  for (const b of biomes) {
    if (b.is_published === false || b.path_points.length < 3) continue;
    const w = byId.get(b.id);
    if (!w || !inPoly(place.x, place.y, b.path_points)) continue;
    const factor = weather.kinds[w.kind]?.factor ?? 1;
    if (!best || factor > best.factor) best = { kind: w.kind, next: w.next, factor };
  }
  return best ? { kind: best.kind, next: best.next, own: false } : { kind: 'clair', next: null, own: false };
}

export const WEATHER_GLYPH: Record<string, string> = {
  clair: '☀️', nuageux: '☁️', vent: '🌬️', pluie: '🌧️', brouillard: '🌫️', orage: '⛈️',
  neige: '🌨️', blizzard: '❄️', canicule: '🔥', tempete_sable: '🏜️', cendres: '🌋',
};

export function inPoly(x: number, y: number, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/** Points d'échantillon d'une route : mêmes que le serveur (_route_samples). */
function routeSamples(r: MapRoute, places: Map<string, MapPlace>): Point[] {
  const a = r.from_place_id ? places.get(r.from_place_id) : undefined;
  const b = r.to_place_id ? places.get(r.to_place_id) : undefined;
  const pts: Point[] = [...(a ? [{ x: a.x, y: a.y }] : []), ...(r.path_points ?? []), ...(b ? [{ x: b.x, y: b.y }] : [])];
  const out: Point[] = [];
  pts.forEach((p, i) => {
    out.push(p);
    if (i < pts.length - 1) out.push({ x: (p.x + pts[i + 1].x) / 2, y: (p.y + pts[i + 1].y) / 2 });
  });
  return out;
}

/** Pire météo d'une route (même règle que _points_weather) : un point posé
 *  sur un lieu qui a ses propres règles prend le temps de ce lieu. */
export function routeWeather(
  r: MapRoute,
  places: Map<string, MapPlace>,
  biomes: MapBiome[],
  weather: WeatherNow | null
): { kind: string; factor: number } {
  if (!weather?.enabled) return { kind: 'clair', factor: 1 };
  const own = (weather.places ?? [])
    .map((w) => ({ w, p: places.get(w.id) }))
    .filter((o): o is { w: PlaceWeather; p: MapPlace } => !!o.p);
  let best: { kind: string; factor: number } | null = null;
  for (const pt of routeSamples(r, places)) {
    const at = own.find((o) => Math.abs(o.p.x - pt.x) < 0.001 && Math.abs(o.p.y - pt.y) < 0.001);
    const w = at ? { kind: at.w.kind as string, factor: weather.kinds[at.w.kind]?.factor ?? 1 } : pointBiomeWeather(pt.x, pt.y, biomes, weather);
    if (w && (!best || w.factor > best.factor)) best = w;
  }
  return best ?? { kind: 'clair', factor: 1 };
}

/** Routes avec leur durée corrigée par la météo (pour le calcul d'itinéraire). */
export function weatherRoutes(routes: MapRoute[], places: MapPlace[], biomes: MapBiome[], weather: WeatherNow | null): MapRoute[] {
  if (!weather?.enabled) return routes;
  const byId = new Map(places.map((p) => [p.id, p]));
  return routes.map((r) => {
    const w = routeWeather(r, byId, biomes, weather);
    return w.factor === 1 ? r : { ...r, travel_minutes: Math.round(routeWeight(r) * w.factor * 100) / 100 };
  });
}

export const fmtFactor = (f: number) =>
  f === 1 ? 'sans effet' : f > 1 ? `trajets +${Math.round((f - 1) * 100)} %` : `trajets −${Math.round((1 - f) * 100)} %`;
