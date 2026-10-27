'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { currentUser } from '@/lib/supabase/session';
import type { CharacterPosition } from '@/lib/types';
import { computeRemainingMinutes } from '@/lib/travel';

export function usePositions() {
  const supabase = createClient();
  const [positions, setPositions] = useState<CharacterPosition[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const arrivingRef = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('list_active_positions');
    setPositions((data as CharacterPosition[]) ?? []);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    currentUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    load();

    const channel = supabase
      .channel('character-positions-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'character_positions' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myPosition = positions.find((p) => p.user_id === myUserId) ?? null;

  // Vérifie périodiquement si mon voyage en cours est terminé, et
  // finalise l'arrivée côté serveur (qui revalide le temps écoulé —
  // impossible de tricher en appelant trop tôt).
  useEffect(() => {
    if (!myPosition?.travel_started_at) return;
    const check = async () => {
      if (arrivingRef.current) return;
      const remaining = computeRemainingMinutes(myPosition, Date.now());
      if (remaining <= 0) {
        arrivingRef.current = true;
        await supabase.rpc('arrive_at_destination');
        arrivingRef.current = false;
        load();
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPosition?.travel_started_at, myPosition?.travel_duration_minutes]);

  async function setInitialPlace(placeId: string) {
    const { data, error } = await supabase.rpc('set_initial_place', { p_place_id: placeId });
    if (!error) load();
    return { error: error?.message ?? data?.error ?? null };
  }

  async function startJourney(opts: { routeId?: string; targetPlaceId?: string }) {
    const { data, error } = await supabase.rpc('start_journey', {
      p_route_id: opts.routeId ?? null,
      p_target_place_id: opts.targetPlaceId ?? null
    });
    if (!error) load();
    return { error: error?.message ?? data?.error ?? null, data };
  }

  /** Itinéraire à plusieurs étapes, depuis la position actuelle. */
  async function startRoutePlan(steps: { routeId: string; toPlaceId: string }[]) {
    const { data, error } = await supabase.rpc('start_route_plan', {
      p_planned_path: steps.map((s) => ({ route_id: s.routeId, to_place_id: s.toPlaceId }))
    });
    if (!error) load();
    const d = data as { error?: string; message?: string; duration_minutes?: number } | null;
    return {
      error: error ? 'rpc' : d?.error ?? null,
      message: error ? 'Le serveur n’a pas pu lancer le trajet (migration 0113 manquante ?).' : d?.message ?? null,
      data: d
    };
  }

  async function setCurrentBuilding(buildingId: string | null) {
    const { data, error } = await supabase.rpc('set_current_building', { p_building_id: buildingId });
    if (!error) load();
    return { error: error?.message ?? data?.error ?? null };
  }

  async function setStatus(status: string, visible?: boolean) {
    const { data, error } = await supabase.rpc('set_character_status', {
      p_status: status,
      p_visible: visible ?? null
    });
    if (!error) load();
    return { error: error?.message ?? data?.error ?? null };
  }

  async function rentMount(rentalId: string) {
    const { data, error } = await supabase.rpc('rent_mount', { p_rental_id: rentalId });
    if (!error) load();
    return { error: error?.message ?? data?.error ?? null, data };
  }

  async function unequipMount() {
    const { data, error } = await supabase.rpc('unequip_mount');
    if (!error) load();
    return { error: error?.message ?? data?.error ?? null };
  }

  async function checkQuestArrival() {
    const { data } = await supabase.rpc('check_quest_arrival');
    return data as { quest_id: string; validated: boolean; reputation?: number; error?: string }[] | null;
  }

  return {
    positions,
    myPosition,
    myUserId,
    loading,
    setInitialPlace,
    startJourney,
    startRoutePlan,
    setCurrentBuilding,
    setStatus,
    rentMount,
    unequipMount,
    checkQuestArrival,
    reload: load
  };
}
