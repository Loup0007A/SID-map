export interface MapTexture {
  id: string;
  name: string;
  motif: string;
  glyph: string | null;
  color: string;
  bg: string | null;
  size: number;
  opacity: number;
  rotation: number;
  stagger: boolean;
}

// Motifs dessinés dans une boîte 10×10 (trait + remplissage = color).
export const MOTIFS: Record<string, { label: string; d: string; fill?: boolean; stroke?: boolean }> = {
  triangle: { label: '△ Triangle', d: 'M1 9 L5 1 L9 9 Z', fill: true },
  mountain: { label: '⛰ Montagne', d: 'M0.5 9 L4 2.5 L6 6 L7.2 4.2 L9.5 9 Z', fill: true },
  pine: { label: '🌲 Sapin', d: 'M5 0.5 L8.5 6 L6.3 6 L9 9 L1 9 L3.7 6 L1.5 6 Z', fill: true },
  tree: { label: '🌳 Arbre', d: 'M5 0.8 A3.4 3.4 0 1 1 4.99 0.8 Z M4.4 7 H5.6 V9.6 H4.4 Z', fill: true },
  wave: { label: '〰 Vague', d: 'M0 5 Q2.5 1 5 5 T10 5', stroke: true },
  dots: { label: '• Points', d: 'M5 3.6 A1.4 1.4 0 1 1 4.99 3.6 Z', fill: true },
  cross: { label: '✚ Croix', d: 'M5 2 V8 M2 5 H8', stroke: true },
  hatch: { label: '／ Hachures', d: 'M1 9 L9 1', stroke: true },
  grass: { label: '🌱 Herbe', d: 'M2 9 L3 4 M5 9 L5 2.5 M8 9 L7 4', stroke: true },
  reed: { label: '🌾 Roseaux', d: 'M3 9 V3 M3 3 Q4.5 1 3 0.5 M7 9 V4 M2 6 H4 M6 7 H8', stroke: true },
  cactus: { label: '🌵 Cactus', d: 'M5 9 V2 M5 6 H2.5 V4 M5 5 H7.5 V3', stroke: true },
  flake: { label: '❄ Flocon', d: 'M5 1 V9 M1.5 3 L8.5 7 M8.5 3 L1.5 7', stroke: true },
  glyph: { label: '😀 Caractère / emoji', d: '' }
};

export const BUILTIN_TEXTURES: MapTexture[] = [
  { id: 'builtin:mountain', name: 'Montagnes', motif: 'mountain', glyph: null, color: '#3b2f2a', bg: null, size: 3.2, opacity: 0.75, rotation: 0, stagger: true },
  { id: 'builtin:triangle', name: 'Triangles', motif: 'triangle', glyph: null, color: '#2e2622', bg: null, size: 2.6, opacity: 0.6, rotation: 0, stagger: true },
  { id: 'builtin:pine', name: 'Forêt de sapins', motif: 'pine', glyph: null, color: '#14391f', bg: null, size: 2.4, opacity: 0.8, rotation: 0, stagger: true },
  { id: 'builtin:tree', name: 'Forêt', motif: 'tree', glyph: null, color: '#1d5a2a', bg: null, size: 2.4, opacity: 0.8, rotation: 0, stagger: true },
  { id: 'builtin:jungle', name: 'Jungle', motif: 'tree', glyph: null, color: '#0e6b3a', bg: null, size: 1.9, opacity: 0.85, rotation: 0, stagger: true },
  { id: 'builtin:grass', name: 'Herbe', motif: 'grass', glyph: null, color: '#2f6b2a', bg: null, size: 2, opacity: 0.6, rotation: 0, stagger: true },
  { id: 'builtin:sand', name: 'Sable', motif: 'dots', glyph: null, color: '#7a5a22', bg: null, size: 1.4, opacity: 0.6, rotation: 0, stagger: true },
  { id: 'builtin:cactus', name: 'Cactus', motif: 'cactus', glyph: null, color: '#3f6b2a', bg: null, size: 3, opacity: 0.8, rotation: 0, stagger: true },
  { id: 'builtin:reed', name: 'Marais', motif: 'reed', glyph: null, color: '#36502a', bg: null, size: 2.4, opacity: 0.7, rotation: 0, stagger: true },
  { id: 'builtin:snow', name: 'Neige', motif: 'flake', glyph: null, color: '#ffffff', bg: null, size: 2, opacity: 0.7, rotation: 0, stagger: true },
  { id: 'builtin:wave', name: 'Vagues', motif: 'wave', glyph: null, color: '#cfe8ff', bg: null, size: 2.6, opacity: 0.5, rotation: 0, stagger: true },
  { id: 'builtin:hatch', name: 'Hachures', motif: 'hatch', glyph: null, color: '#000000', bg: null, size: 1.6, opacity: 0.35, rotation: 0, stagger: false }
];

const BUILTIN_BY_ID = new Map(BUILTIN_TEXTURES.map((t) => [t.id, t]));

// Texture par défaut d'un biome quand aucune n'est choisie.
export const BIOME_DEFAULT_TEXTURE: Record<string, string> = {
  foret_dense: 'builtin:pine',
  jungle: 'builtin:jungle',
  desert_aride: 'builtin:sand',
  toundra: 'builtin:snow',
  marecage: 'builtin:reed',
  montagneux: 'builtin:mountain',
  volcanique: 'builtin:triangle',
  plaine: 'builtin:grass'
};

export function reliefDefaultTexture(elevation: number): string | null {
  if (elevation >= 50) return 'builtin:mountain';
  if (elevation >= 25) return 'builtin:triangle';
  return null;
}

export function findTexture(id: string | null | undefined, custom: MapTexture[]): MapTexture | null {
  if (!id) return null;
  return BUILTIN_BY_ID.get(id) ?? custom.find((t) => t.id === id) ?? null;
}

// ID SVG sûr pour un <pattern>.
export function patternId(id: string) {
  return 'tex-' + id.replace(/[^a-zA-Z0-9]/g, '_');
}
