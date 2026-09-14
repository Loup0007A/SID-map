import type { Point } from './types';

export function pointAtProgress(points: Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const clamped = Math.max(0, Math.min(1, t));
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLengths.push(d);
    total += d;
  }
  if (total === 0) return points[0];

  let target = clamped * total;
  for (let i = 0; i < segLengths.length; i++) {
    if (target <= segLengths[i] || i === segLengths.length - 1) {
      const segT = segLengths[i] === 0 ? 0 : target / segLengths[i];
      const a = points[i];
      const b = points[i + 1];
      return { x: a.x + (b.x - a.x) * segT, y: a.y + (b.y - a.y) * segT };
    }
    target -= segLengths[i];
  }
  return points[points.length - 1];
}
