import type { CharacterPosition, MapPlace, MapRoute, Point } from './types';
import { pointAtProgress } from './routeGeometry';

export function computeProgress(pos: CharacterPosition, nowMs: number): number {
  if (!pos.travel_started_at || !pos.travel_duration_minutes) return 0;
  const elapsedMin = (nowMs - new Date(pos.travel_started_at).getTime()) / 60000;
  return Math.max(0, Math.min(1, elapsedMin / pos.travel_duration_minutes));
}

export function computeRemainingMinutes(pos: CharacterPosition, nowMs: number): number {
  if (!pos.travel_started_at || !pos.travel_duration_minutes) return 0;
  const elapsedMin = (nowMs - new Date(pos.travel_started_at).getTime()) / 60000;
  return Math.max(0, pos.travel_duration_minutes - elapsedMin);
}

export function isTraveling(pos: CharacterPosition | null): boolean {
  return !!pos?.travel_started_at;
}

export function travelerScreenPosition(
  pos: CharacterPosition,
  places: MapPlace[],
  routes: MapRoute[],
  nowMs: number
): Point | null {
  const progress = computeProgress(pos, nowMs);

  if (pos.route_id) {
    const route = routes.find((r) => r.id === pos.route_id);
    if (!route) return null;
    const points = route.from_place_id === pos.place_id ? route.path_points : [...route.path_points].reverse();
    return pointAtProgress(points, progress);
  }

  if (pos.flight_target_place_id) {
    const from = places.find((p) => p.id === pos.place_id);
    const to = places.find((p) => p.id === pos.flight_target_place_id);
    if (!from || !to) return null;
    return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
  }

  return null;
}

export function formatMinutes(min: number): string {
  const m = Math.ceil(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}
