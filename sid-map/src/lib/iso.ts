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

export const SLAB_THICKNESS = 3; // épaisseur de la dalle de plancher
export const WALL_HEIGHT = 20; // hauteur de mur (façade vitrée) par étage
export const FLOOR_STEP = SLAB_THICKNESS + WALL_HEIGHT; // pas vertical entre étages (empilement continu)
