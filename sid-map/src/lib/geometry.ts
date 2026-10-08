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
