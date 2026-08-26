export interface Iso2D {
  x: number;
  y: number;
}

const ANGLE = Math.PI / 6; // 30°
const COS = Math.cos(ANGLE);
const SIN = Math.sin(ANGLE);

export function isoProject(x: number, y: number, z: number): Iso2D {
  return {
    x: (x - y) * COS,
    y: (x + y) * SIN - z
  };
}

export const FLOOR_HEIGHT = 26; // écart vertical entre étages empilés
export const WALL_HEIGHT = 13; // hauteur des murs dans la projection
