import type { Point } from './types';

export function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 50, y: 50 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

// Réduit le nombre de points d'un tracé (économie de stockage et de
// rendu) : supprime les points quasi alignés (Ramer–Douglas–Peucker)
// et arrondit à 2 décimales.
export function simplifyPath(points: Point[], tolerance = 0.12): Point[] {
  if (points.length <= 3) return points.map((p) => ({ x: round2(p.x), y: round2(p.y) }));
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(points[i], points[a], points[b]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tolerance) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = points.filter((_, i) => keep[i]).map((p) => ({ x: round2(p.x), y: round2(p.y) }));
  return out.length >= 3 ? out : points.map((p) => ({ x: round2(p.x), y: round2(p.y) }));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function insidePolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function edgeDistance(pt: Point, poly: Point[]): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distToSegment(pt, poly[i], poly[j]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Où écrire le nom d'une région : le point le plus « au large » de ses
 * bords, à l'intérieur de son tracé ET hors des autres régions dessinées
 * par-dessus (`obstacles`).
 *
 * La moyenne des sommets ne convient pas : pour un océan qui entoure un
 * continent, elle tombe en plein milieu du continent.
 * `clearance` = distance libre autour du point (sert à borner la taille
 * du texte). Renvoie null si la région est entièrement recouverte.
 */
export function labelAnchor(poly: Point[], obstacles: Point[][], grid = 28): { point: Point; clearance: number } | null {
  if (poly.length < 3) return null;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // Seuls les obstacles qui touchent la boîte englobante comptent.
  const near = obstacles.filter((o) => o.length >= 3 && o.some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY));
  let best: { point: Point; clearance: number } | null = null;
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const pt = { x: minX + ((i + 0.5) / grid) * (maxX - minX), y: minY + ((j + 0.5) / grid) * (maxY - minY) };
      if (!insidePolygon(pt, poly)) continue;
      if (near.some((o) => insidePolygon(pt, o))) continue;
      let d = edgeDistance(pt, poly);
      for (const o of near) {
        if (d <= (best?.clearance ?? 0)) break;
        d = Math.min(d, edgeDistance(pt, o));
      }
      if (!best || d > best.clearance) best = { point: pt, clearance: d };
    }
  }
  return best;
}
