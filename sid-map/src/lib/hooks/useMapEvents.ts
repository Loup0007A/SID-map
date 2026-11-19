'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WeatherNow } from '@/lib/weather';

/** Météo des biomes : rechargée toutes les 5 minutes (elle change toutes les 3 heures). */
export function useWeather() {
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc('map_weather_now');
    setWeather(error ? null : ((data as WeatherNow) ?? null));
  }, []);
  useEffect(() => {
    void load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);
  return { weather, reload: load };
}

export type Incursion = {
  id: string;
  starts_at: string;
  ends_at: string;
  started: boolean;
  path: { x: number; y: number }[];
  x: number;
  y: number;
  quest_id: string | null;
  sightings: number;
  seen_by_me: boolean;
  reach: number;
  km_per_unit: number;
  entry: { category: string; number: number; title: string | null; summary: string | null; image_url: string | null; rarity: number | null };
};

/** Créature en incursion : vérifiée chaque minute. */
export function useIncursion() {
  const [incursion, setIncursion] = useState<Incursion | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc('map_incursion_current');
    setIncursion(error ? null : ((data as { active?: Incursion | null } | null)?.active ?? null));
  }, []);
  useEffect(() => {
    void load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);
  return { incursion, reload: load };
}

/** Position sur le parcours à un instant (même calcul que _incursion_pos). */
export function incursionPos(inc: Incursion, now: number): { x: number; y: number; done: { x: number; y: number }[] } {
  const p = inc.path;
  if (p.length === 0) return { x: inc.x, y: inc.y, done: [] };
  const t0 = new Date(inc.starts_at).getTime();
  const t1 = new Date(inc.ends_at).getTime();
  const frac = Math.max(0, Math.min(1, (now - t0) / Math.max(1, t1 - t0)));
  const segs = p.slice(1).map((b, i) => Math.hypot(b.x - p[i].x, b.y - p[i].y));
  let goal = frac * segs.reduce((a, b) => a + b, 0);
  const done = [p[0]];
  for (let i = 0; i < segs.length; i++) {
    if (goal <= segs[i] || i === segs.length - 1) {
      const k = segs[i] > 0 ? Math.min(1, goal / segs[i]) : 0;
      const pt = { x: p[i].x + (p[i + 1].x - p[i].x) * k, y: p[i].y + (p[i + 1].y - p[i].y) * k };
      return { ...pt, done: [...done, pt] };
    }
    goal -= segs[i];
    done.push(p[i + 1]);
  }
  return { x: p[p.length - 1].x, y: p[p.length - 1].y, done };
}

export type EventSettings = { weather_enabled?: boolean; incursions_enabled?: boolean; incursion_chance?: number; incursion_sight_reputation?: number };

/** Réglages météo et incursions (lus dans map_settings). */
export function useEventSettings() {
  const [settings, setSettings] = useState<EventSettings>({});
  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from('map_settings')
      .select('weather_enabled, incursions_enabled, incursion_chance, incursion_sight_reputation')
      .order('id')
      .limit(1)
      .maybeSingle();
    if (!error && data) setSettings({ ...data, incursion_chance: Number(data.incursion_chance) });
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { settings, reload: load };
}
