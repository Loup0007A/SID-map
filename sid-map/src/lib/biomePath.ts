import type { MapBiome, Point } from './types';

function inPoly(px: number, py: number, pts: Point[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Même logique que path_blocked_biome (SQL) : premier biome interdit traversé.
export function blockedBiome(line: Point[], biomes: MapBiome[], allowed: string[] | null | undefined): string | null {
  if (!allowed || allowed.length === 0 || line.length < 2) return null;
  const forbidden = biomes.filter((b) => b.is_published !== false && !allowed.includes(b.biome_type) && b.path_points.length >= 3);
  if (forbidden.length === 0) return null;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
    for (let s = 0; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps;
      const y = a.y + ((b.y - a.y) * s) / steps;
      for (const f of forbidden) if (inPoly(x, y, f.path_points)) return f.biome_type;
    }
  }
  return null;
}
