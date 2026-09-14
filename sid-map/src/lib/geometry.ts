import type { Point } from './types';

export function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 50, y: 50 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
