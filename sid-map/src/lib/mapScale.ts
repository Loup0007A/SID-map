import type { MapPlace, MountType } from './types';

export interface MapSettings {
  km_per_unit: number;
  walk_kmh: number;
  unit_label: string;
}

export const DEFAULT_SETTINGS: MapSettings = { km_per_unit: 5, walk_kmh: 5, unit_label: 'km' };

export function distanceUnits(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceKm(a: MapPlace, b: MapPlace, s: MapSettings) {
  return distanceUnits(a, b) * s.km_per_unit;
}

// Même formule que start_journey (côté serveur) : sert à l'affichage.
export function flightMinutes(distKm: number, mount: MountType, s: MapSettings) {
  const speed = mount.flight_speed_kmh ?? s.walk_kmh * (mount.speed_multiplier || 1);
  return Math.max(2, Math.round((distKm / speed) * 60));
}

export function formatDistance(km: number, unit = 'km') {
  return km >= 100 ? `${Math.round(km)} ${unit}` : `${Math.round(km * 10) / 10} ${unit}`;
}

// Longueur "ronde" (1, 2, 5 × 10^n) la plus proche de targetKm.
export function niceDistance(targetKm: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(targetKm)));
  const n = targetKm / pow;
  const f = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return f * pow;
}
