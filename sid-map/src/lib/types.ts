export type Point = { x: number; y: number };

export type ZoneType = 'continent' | 'ile' | 'mer' | 'ocean';
export type PlaceType =
  | 'ville' | 'merveille' | 'foret' | 'desert' | 'montagne' | 'ruine' | 'village' | 'autre';
export type BuildingType = 'maison' | 'cathedrale' | 'auberge' | 'commerce' | 'autre';

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
}

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
}

export interface BuildingFloor {
  id: string;
  building_id: string;
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

export const BUILDING_LABELS: Record<BuildingType, string> = {
  maison: 'Maison',
  cathedrale: 'Cathédrale',
  auberge: 'Auberge',
  commerce: 'Commerce',
  autre: 'Autre'
};
