export type Point = { x: number; y: number };

export type ZoneType = 'continent' | 'ile' | 'mer' | 'ocean';
export type PlaceType =
  | 'ville' | 'merveille' | 'foret' | 'desert' | 'montagne' | 'ruine' | 'village' | 'autre';
// Les types de bâtiments sont désormais dynamiques (table
// map_icon_config), donc une simple string plutôt qu'une union fermée.
export type BuildingType = string;

export interface MapZone {
  id: string;
  name: string;
  type: ZoneType;
  color: string;
  path_points: Point[];
  description: string | null;
  image_url: string | null;
  z_index: number;
  is_published: boolean;
  controlling_group_id: string | null;
}

export type MarkerShape = 'circle' | 'rect';

export interface MapPlace {
  id: string;
  zone_id: string | null;
  name: string;
  type: PlaceType;
  x: number;
  y: number;
  icon: string | null;
  description: string | null;
  image_url: string | null;
  is_published: boolean;
  shape: MarkerShape;
  radius: number;
  width: number | null;
  height: number | null;
  controlling_group_id: string | null;
  is_building: boolean;
  allows_black_market?: boolean;
}

export interface CityDistrict {
  id: string;
  city_id: string;
  name: string;
  color: string;
  path_points: Point[];
  description: string | null;
}

export interface CityBuilding {
  id: string;
  city_id: string;
  district_id: string | null;
  type: BuildingType;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: MarkerShape;
  description: string | null;
  image_url: string | null;
  owner_id: string | null;
}

export interface Room {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  connectsToFloor?: number; // pour un escalier : le numéro d'étage relié
}

export interface BuildingFloor {
  id: string;
  building_id: string | null;
  place_id: string | null;
  floor_number: number;
  name: string | null;
  plan_data: Room[];
  description: string | null;
  image_url: string | null;
}

export interface MapComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  avatar_url: string | null;
  member_rank: string | null;
}

export interface MapRoute {
  id: string;
  name: string | null;
  from_place_id: string | null;
  to_place_id: string | null;
  path_points: Point[];
  color: string;
  travel_minutes: number | null;
  is_published: boolean;
}

export interface CharacterPosition {
  user_id: string;
  place_id: string | null;
  building_id: string | null;
  route_id: string | null;
  flight_target_place_id: string | null;
  travel_started_at: string | null;
  travel_duration_minutes: number | null;
  arrived_at: string | null;
  active_mount_id: string | null;
  status: string | null;
  is_visible: boolean;
  updated_at: string;
  nickname: string | null;
  avatar_url: string | null;
  member_rank: string | null;
}

export interface MountType {
  id: string;
  name: string;
  icon: string;
  speed_multiplier: number;
  can_fly: boolean;
  rental_price: number;
  created_by: string | null;
}

export interface MountRental {
  id: string;
  place_id: string;
  mount_type_id: string;
  price_override: number | null;
  stock: number | null;
  created_by: string | null;
}

export interface MapRelief {
  id: string;
  path_points: Point[];
  elevation: number;
  is_published: boolean;
  texture_id?: string | null;
}

export type BiomeType =
  | 'plaine' | 'foret_dense' | 'jungle' | 'desert_aride' | 'toundra' | 'marecage' | 'montagneux' | 'volcanique';

export interface MapBiome {
  id: string;
  path_points: Point[];
  biome_type: BiomeType | string;
  color: string;
  is_published: boolean;
  texture_id?: string | null;
}

export const BIOME_LABELS: Record<string, string> = {
  plaine: 'Plaine',
  foret_dense: 'Forêt dense',
  jungle: 'Jungle',
  desert_aride: 'Désert aride',
  toundra: 'Toundra',
  marecage: 'Marécage',
  montagneux: 'Montagneux',
  volcanique: 'Volcanique'
};

export const BIOME_COLORS: Record<string, string> = {
  plaine: '#7ba05b',
  foret_dense: '#2f5233',
  jungle: '#1e6b3a',
  desert_aride: '#d9b26f',
  toundra: '#a8c3d0',
  marecage: '#4a5d3a',
  montagneux: '#8a7f6b',
  volcanique: '#7a2e2e'
};

export interface MapGroup {
  id: string;
  label: string;
}

export interface MapQuest {
  id: string;
  title: string;
  place_id: string;
  status: string | null;
  contract_type: string | null;
  reward: string | null;
  visibility: string | null;
}

export const ZONE_LABELS: Record<ZoneType, string> = {
  continent: 'Continent',
  ile: 'Île',
  mer: 'Mer',
  ocean: 'Océan'
};

export const PLACE_LABELS: Record<PlaceType, string> = {
  ville: 'Ville',
  merveille: 'Merveille',
  foret: 'Forêt',
  desert: 'Désert',
  montagne: 'Montagne',
  ruine: 'Ruine',
  village: 'Village',
  autre: 'Autre'
};

export const BUILDING_LABELS: Record<string, string> = {
  maison: 'Maison',
  cathedrale: 'Cathédrale',
  auberge: 'Auberge',
  commerce: 'Commerce',
  autre: 'Autre'
};

export interface BlackMarketStall {
  id: string;
  place_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface BlackMarketItem {
  id: string;
  stall_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
}

export interface TeleportCrystal {
  id: string;
  label: string;
  from_place_id: string;
  to_place_id: string;
  holder_id: string;
  is_single_use: boolean;
  used_at: string | null;
}

const FINISHED_STATUSES = [
  'validated','validee','validée','valide','validé','completed','complete','complétée','completee',
  'terminee','terminée','termine','terminé','done','finished','closed','cloturee','clôturée',
  'archived','archivee','archivée','cancelled','canceled','annulee','annulée','expired','expiree',
  'expirée','failed','echouee','échouée'
];
export function isQuestFinished(status: string | null | undefined): boolean {
  return FINISHED_STATUSES.includes((status ?? '').toLowerCase());
}
