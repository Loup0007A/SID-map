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
    // Sens de l'étape : depuis place_id (lieu de départ de l'étape), ou, pour
    // un ancien trajet sans lieu, vers la prochaine étape prévue.
    const next = pos.planned_path?.[0]?.route_id === route.id ? pos.planned_path[0].to_place_id : null;
    const forward = pos.place_id ? route.from_place_id === pos.place_id : next ? route.to_place_id === next : true;
    const points = forward ? route.path_points : [...route.path_points].reverse();
    return pointAtProgress(points, progress);
  }

  if (pos.flight_target_place_id) {
    const from = places.find((p) => p.id === pos.place_id);
    const to = places.find((p) => p.id === pos.flight_target_place_id);
    if (!from || !to) return null;
    return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
  }

  // Pause à un lieu de passage (0123) : le personnage attend sur place.
  if (pos.place_id) {
    const here = places.find((p) => p.id === pos.place_id);
    if (here) return { x: here.x, y: here.y };
  }

  return null;
}

/** En pause à une étape (trajet avec arrêts, 0123). */
export function isPaused(pos: CharacterPosition | null): boolean {
  return !!pos?.travel_started_at && !pos.route_id && !pos.flight_target_place_id && !!pos.planned_path?.[0]?.pause;
}

export function formatMinutes(min: number): string {
  const m = Math.ceil(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}

/** Où mène le trajet en cours (destination finale), et à quelle étape on en est. */
export function tripInfo(pos: CharacterPosition | null, routes: MapRoute[], nowMs: number) {
  if (!pos?.travel_started_at) return null;
  const legs = pos.planned_path ?? [];
  const paused = isPaused(pos);
  let destinationId: string | null = null;
  if (pos.flight_target_place_id && !pos.route_id) destinationId = pos.flight_target_place_id;
  else if (legs.length > 0) destinationId = [...legs].reverse().find((l) => l.to_place_id)?.to_place_id ?? null;
  else if (pos.route_id) {
    const r = routes.find((x) => x.id === pos.route_id);
    if (r) destinationId = r.from_place_id === pos.place_id ? r.to_place_id : r.from_place_id;
  }
  const legRemaining = computeRemainingMinutes(pos, nowMs);
  const laterLegs = legs.slice(1).reduce((sum, l) => {
    if (l.pause) return sum + (l.minutes ?? 0);
    const r = routes.find((x) => x.id === l.route_id);
    return sum + (l.minutes ?? (r ? r.travel_minutes ?? 30 : 30));
  }, 0);
  const roads = legs.filter((l) => !l.pause);
  return {
    destinationId,
    /** prochain lieu atteint (fin de l'étape en cours, ou après la pause) */
    nextStopId: legs.find((l) => l.to_place_id)?.to_place_id ?? destinationId,
    /** routes restantes, étape en cours comprise (pauses non comptées) */
    legCount: Math.max(1, roads.length),
    legRemainingMinutes: legRemaining,
    remainingMinutes: legRemaining + laterLegs,
    /** avancement de l'étape en cours (0 → 1) */
    legProgress: computeProgress(pos, nowMs),
    paused,
    /** fin de la pause en cours */
    pauseEndsAt: paused && pos.travel_duration_minutes ? new Date(new Date(pos.travel_started_at).getTime() + pos.travel_duration_minutes * 60000) : null,
    pauses: legs.filter((l) => l.pause).length
  };
}
