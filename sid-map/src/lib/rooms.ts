/**
 * Pièces des intérieurs (Lot 92) : type, sol et mobilier dessinés sur le
 * plan. Les anciens types (Chambre, Salon…) gardent leur nom.
 */
export type FloorPattern = 'parquet' | 'planches' | 'carreaux' | 'dalles' | 'pierre' | 'terre' | 'herbe' | 'tapis' | 'platre';
export type Furniture =
  | 'lit' | 'table' | 'four' | 'bancs' | 'autel' | 'tonneaux' | 'comptoir' | 'enclume'
  | 'etageres' | 'baignoire' | 'caisses' | 'arbre' | 'marches' | 'coffre' | null;

export type RoomType = { key: string; floor: FloorPattern; tint: string; furniture: Furniture };

export const ROOM_TYPES: RoomType[] = [
  { key: 'Chambre', floor: 'parquet', tint: '#c9965e', furniture: 'lit' },
  { key: 'Salon', floor: 'tapis', tint: '#b0413a', furniture: 'table' },
  { key: 'Cuisine', floor: 'carreaux', tint: '#d9c9a6', furniture: 'four' },
  { key: 'Salle', floor: 'dalles', tint: '#cdbfa5', furniture: 'bancs' },
  { key: 'Couloir', floor: 'planches', tint: '#a87447', furniture: null },
  { key: 'Escalier', floor: 'planches', tint: '#8f5d34', furniture: 'marches' },
  { key: 'Autel', floor: 'dalles', tint: '#d8c48f', furniture: 'autel' },
  { key: 'Cave', floor: 'pierre', tint: '#8c7a62', furniture: 'tonneaux' },
  { key: 'Boutique', floor: 'planches', tint: '#b9824f', furniture: 'comptoir' },
  { key: 'Atelier', floor: 'terre', tint: '#9a7650', furniture: 'enclume' },
  { key: 'Bibliothèque', floor: 'parquet', tint: '#b78655', furniture: 'etageres' },
  { key: 'Bain', floor: 'carreaux', tint: '#bcd8d6', furniture: 'baignoire' },
  { key: 'Réserve', floor: 'terre', tint: '#8b6a47', furniture: 'caisses' },
  { key: 'Trésor', floor: 'dalles', tint: '#c8a75a', furniture: 'coffre' },
  { key: 'Cour', floor: 'herbe', tint: '#8daa5b', furniture: 'arbre' },
  { key: 'Autre', floor: 'platre', tint: '#e8dcc4', furniture: null },
];

export const roomType = (key: string): RoomType => ROOM_TYPES.find((t) => t.key === key) ?? ROOM_TYPES[ROOM_TYPES.length - 1];

export const floorLabel = (n: number, name?: string | null) =>
  name || (n === 0 ? 'Rez-de-chaussée' : n < 0 ? `Sous-sol ${Math.abs(n)}` : `Étage ${n}`);

/** Grille d'aimantation du plan (en % de la feuille). */
export const SNAP = 1;
export const snap = (v: number) => Math.round(v / SNAP) * SNAP;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
