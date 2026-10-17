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

// Une icône est soit un emoji, soit l'adresse d'une image importée
// (.png, .ico…) rangée dans le dossier « icons » du stockage de la carte.
export function isImageIcon(value: string | null | undefined): value is string {
  return !!value && /^(https?:\/\/|\/|data:image\/)/.test(value);
}

// Pour les endroits qui n'acceptent que du texte (options de liste).
export function iconText(value: string | null | undefined, fallback = '📍') {
  return isImageIcon(value) ? '🖼️' : value || fallback;
}

export const ICON_FOLDER = 'icons';
export const ICON_ACCEPT = '.png,.ico,.webp,.svg,.gif,.jpg,.jpeg,image/png,image/x-icon,image/vnd.microsoft.icon';
export const ICON_MAX_BYTES = 512 * 1024;
