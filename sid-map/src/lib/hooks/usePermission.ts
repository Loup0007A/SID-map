'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { currentUser } from '@/lib/supabase/session';

/**
 * Vérifie si le membre connecté a une permission donnée (ou est
 * fondateur). S'appuie sur la RPC has_permission du premier site, qui
 * compte déjà le fondateur : une seule requête.
 *
 * Plusieurs composants posent la même question au même moment (légende,
 * lanceur d'applications, panneaux…) : la réponse est partagée et gardée le
 * temps de la visite (une minute).
 */
const FRESH_MS = 60_000;
const cache = new Map<string, { at: number; uid: string; value: boolean }>();
const inflight = new Map<string, Promise<boolean>>();

async function checkPermission(permission: string): Promise<boolean> {
  const {
    data: { user }
  } = await currentUser();
  if (!user) return false;
  const hit = cache.get(permission);
  if (hit && hit.uid === user.id && Date.now() - hit.at < FRESH_MS) return hit.value;
  const key = `${user.id}:${permission}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const { data } = await createClient().rpc('has_permission', { uid: user.id, perm: permission });
    const value = Boolean(data);
    cache.set(permission, { at: Date.now(), uid: user.id, value });
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function usePermission(permission: string) {
  const known = cache.get(permission);
  const [allowed, setAllowed] = useState(known ? known.value : false);
  const [loading, setLoading] = useState(!known);

  useEffect(() => {
    let active = true;
    checkPermission(permission).then((ok) => {
      if (!active) return;
      setAllowed(ok);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [permission]);

  return { allowed, loading };
}
