import type { MapRoute, Point } from './types';

function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return total;
}

function routeWeight(r: MapRoute): number {
  // Utilise le temps de trajet RP s'il est renseigné, sinon une
  // estimation à partir de la longueur du tracé (pour départager les
  // itinéraires quand aucun temps n'est précisé).
  return r.travel_minutes ?? Math.max(5, Math.round(pathLength(r.path_points) * 2));
}

export interface RouteStep {
  route: MapRoute;
  fromPlaceId: string;
  toPlaceId: string;
}

export interface RoutePlan {
  steps: RouteStep[];
  totalMinutes: number;
  placeIds: string[];
}

export function findShortestPath(
  fromPlaceId: string,
  toPlaceId: string,
  routes: MapRoute[]
): RoutePlan | null {
  if (fromPlaceId === toPlaceId) return { steps: [], totalMinutes: 0, placeIds: [fromPlaceId] };

  const adjacency = new Map<string, { neighbor: string; route: MapRoute; weight: number }[]>();
  for (const r of routes) {
    if (!r.from_place_id || !r.to_place_id) continue;
    const w = routeWeight(r);
    if (!adjacency.has(r.from_place_id)) adjacency.set(r.from_place_id, []);
    if (!adjacency.has(r.to_place_id)) adjacency.set(r.to_place_id, []);
    adjacency.get(r.from_place_id)!.push({ neighbor: r.to_place_id, route: r, weight: w });
    adjacency.get(r.to_place_id)!.push({ neighbor: r.from_place_id, route: r, weight: w });
  }

  if (!adjacency.has(fromPlaceId) || !adjacency.has(toPlaceId)) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, { place: string; route: MapRoute }>();
  const visited = new Set<string>();
  dist.set(fromPlaceId, 0);

  while (true) {
    let current: string | null = null;
    let currentDist = Infinity;
    for (const [place, d] of dist) {
      if (!visited.has(place) && d < currentDist) {
        current = place;
        currentDist = d;
      }
    }
    if (current === null) break;
    if (current === toPlaceId) break;
    visited.add(current);

    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.neighbor)) continue;
      const newDist = currentDist + edge.weight;
      if (newDist < (dist.get(edge.neighbor) ?? Infinity)) {
        dist.set(edge.neighbor, newDist);
        prev.set(edge.neighbor, { place: current, route: edge.route });
      }
    }
  }

  if (!dist.has(toPlaceId)) return null;

  const steps: RouteStep[] = [];
  const placeIds: string[] = [toPlaceId];
  let cursor = toPlaceId;
  while (cursor !== fromPlaceId) {
    const p = prev.get(cursor);
    if (!p) return null;
    steps.unshift({ route: p.route, fromPlaceId: p.place, toPlaceId: cursor });
    placeIds.unshift(p.place);
    cursor = p.place;
  }

  return { steps, totalMinutes: dist.get(toPlaceId)!, placeIds };
}
