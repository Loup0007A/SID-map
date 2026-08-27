import type { Point } from './types';

function round(n: number) {
  return Math.round(n * 100) / 100;
}
function roundP(p: Point): Point {
  return { x: round(p.x), y: round(p.y) };
}

export function circleFromBox(x0: number, y0: number, x1: number, y1: number, n = 36): Point[] {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = Math.max(0.5, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return roundP({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });
}

export function ellipseFromBox(x0: number, y0: number, x1: number, y1: number, n = 36): Point[] {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max(0.5, Math.abs(x1 - x0) / 2);
  const ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return roundP({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  });
}

export function squareFromBox(x0: number, y0: number, x1: number, y1: number): Point[] {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const s = Math.max(1, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  return [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s }
  ].map(roundP);
}

export function rectangleFromBox(x0: number, y0: number, x1: number, y1: number): Point[] {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const w = Math.max(1, Math.abs(x1 - x0));
  const h = Math.max(1, Math.abs(y1 - y0));
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ].map(roundP);
}

export function trapezoidFromBox(x0: number, y0: number, x1: number, y1: number): Point[] {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const w = Math.max(1, Math.abs(x1 - x0));
  const h = Math.max(1, Math.abs(y1 - y0));
  const inset = w * 0.22;
  return [
    { x: x + inset, y },
    { x: x + w - inset, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ].map(roundP);
}

export function simplifyFreehand(points: Point[], minDist = 0.6): Point[] {
  if (points.length === 0) return points;
  const out: Point[] = [points[0]];
  for (const p of points.slice(1)) {
    const last = out[out.length - 1];
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d >= minDist) out.push(p);
  }
  return out.map(roundP);
}
