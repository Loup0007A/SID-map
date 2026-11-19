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
};

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

/** Pire météo d'une route (même règle que _points_weather). */
export function routeWeather(
  r: MapRoute,
  places: Map<string, MapPlace>,
  biomes: MapBiome[],
  weather: WeatherNow | null
): { kind: string; factor: number } {
  if (!weather?.enabled) return { kind: 'clair', factor: 1 };
  const byId = new Map(weather.biomes.map((b) => [b.id, b.kind]));
  let best: { kind: string; factor: number } | null = null;
  for (const b of biomes) {
    if (b.is_published === false || b.path_points.length < 3) continue;
    const kind = byId.get(b.id);
    if (!kind) continue;
    if (!routeSamples(r, places).some((p) => inPoly(p.x, p.y, b.path_points))) continue;
    const factor = weather.kinds[kind]?.factor ?? 1;
    if (!best || factor > best.factor) best = { kind, factor };
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
