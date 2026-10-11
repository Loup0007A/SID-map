import type { Point } from './types';

// Sélection multiple sur la carte : une clé par élément, « genre:id ».
export type SelKind = 'place' | 'zone' | 'relief' | 'biome';

export const SEL_TABLE: Record<SelKind, string> = {
  place: 'map_places',
  zone: 'map_zones',
  relief: 'map_relief',
  biome: 'map_biomes'
};

export function selKey(kind: SelKind, id: string) {
  return `${kind}:${id}`;
}

export function parseSel(key: string): { kind: SelKind; id: string } {
  const i = key.indexOf(':');
  return { kind: key.slice(0, i) as SelKind, id: key.slice(i + 1) };
}

export function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function shiftPoint(p: Point, dx: number, dy: number): Point {
  return { x: r2(p.x + dx), y: r2(p.y + dy) };
}

export function shiftPoints(pts: Point[], dx: number, dy: number): Point[] {
  return pts.map((p) => shiftPoint(p, dx, dy));
}
