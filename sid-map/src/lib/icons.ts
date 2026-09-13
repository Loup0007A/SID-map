import type { PlaceType } from './types';

// Icônes par défaut, une par type de lieu — choisies pour rester
// lisibles et "belles" (emoji pleins plutôt que symboles unicode fins).
export const DEFAULT_PLACE_ICONS: Record<PlaceType, string> = {
  ville: '🏰',
  merveille: '✨',
  foret: '🌲',
  desert: '🏜️',
  montagne: '⛰️',
  ruine: '🏛️',
  village: '🏘️',
  autre: '📍'
};

export const DEFAULT_BUILDING_ICONS: Record<string, string> = {
  maison: '🏠',
  cathedrale: '⛪',
  auberge: '🍺',
  commerce: '🏪',
  autre: '🏗️'
};

// Catalogue proposé dans le sélecteur d'icône (thème fantasy / RP).
export const ICON_CATALOG: string[] = [
  '🏰', '🏯', '🏛️', '⛩️', '🗼', '🏟️', '🏚️', '🏘️', '🏙️',
  '🕌', '⛪', '🛕', '🏕️', '⛺',
  '🌲', '🌳', '🌴', '🌵', '🌾', '🍄',
  '⛰️', '🌋', '🗻', '🏔️', '🏜️', '🏝️',
  '🌊', '⚓', '🌀', '❄️', '🔥',
  '⚔️', '🛡️', '👑', '💀', '☠️', '🔮', '⭐', '✨', '💎', '🗝️',
  '📍', '🚩', '🏴', '⛓️'
];
