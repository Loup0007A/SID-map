'use client';

/**
 * Affichage événementiel (Halloween, Noël, la Grande Chasse et les fêtes de
 * l'année : Saint-Valentin, poisson d'avril, Pâques, 1er mai, fête de la
 * musique, 14 juillet, 11 novembre) — même réglage que le Dossier Central (fonction site_decor,
 * Modération → Affichage événementiel). Fichier identique dans la
 * Cartographie et le Wiki ; seul le style change (variant).
 *
 * Ce fichier est léger : les dessins (EventDecorLayers) ne sont téléchargés
 * que si un événement est affiché. Hors saison, rien n'est chargé.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';

const HOLIDAYS = ['saint_valentin', 'poisson_avril', 'paques', 'premier_mai', 'fete_musique', 'quatorze_juillet', 'armistice'] as const;
type HolidayKey = (typeof HOLIDAYS)[number];
type Decor = { halloween: boolean; noel: boolean; grande_chasse?: boolean } & Partial<Record<HolidayKey, boolean>>;

const HalloweenLayer = dynamic(() => import('./EventDecorLayers').then((m) => m.HalloweenLayer), { ssr: false });
const NoelLayer = dynamic(() => import('./EventDecorLayers').then((m) => m.NoelLayer), { ssr: false });
const HolidayLayer = dynamic(() => import('./EventDecorLayers').then((m) => m.HolidayLayer), { ssr: false });
const ChasseLayer = dynamic(() => import('./EventDecorLayers').then((m) => m.ChasseLayer), { ssr: false });

const STORE_KEY = 'sid-decor-v1';
const FRESH_MS = 5 * 60_000;
let cache: { at: number; value: Decor } | null = null;

// Gardé aussi le temps de la visite : la page suivante affiche le décor sans
// attendre la base (et sans attendre du tout s'il n'y a rien à afficher).
function fromStore(): { at: number; value: Decor } | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { at: number; value: Decor };
    return Date.now() - c.at < FRESH_MS ? c : null;
  } catch {
    return null;
  }
}

export function useEventDecor(): Decor | null {
  // Premier rendu identique au serveur (rien) ; le décor arrive juste après.
  const [decor, setDecor] = useState<Decor | null>(null);
  useEffect(() => {
    cache = cache ?? fromStore();
    if (cache && Date.now() - cache.at < FRESH_MS) {
      setDecor(cache.value);
      return;
    }
    let alive = true;
    createClient()
      .rpc('site_decor')
      .then(({ data, error }) => {
        const d = (error ? null : data) as Partial<Decor> | null;
        const value: Decor = { halloween: !!d?.halloween, noel: !!d?.noel, grande_chasse: !!d?.grande_chasse };
        for (const k of HOLIDAYS) value[k] = !!d?.[k];
        cache = { at: Date.now(), value };
        try {
          sessionStorage.setItem(STORE_KEY, JSON.stringify(cache));
        } catch {
          /* stockage indisponible */
        }
        if (alive) setDecor(value);
      });
    return () => {
      alive = false;
    };
  }, []);
  return decor;
}

export default function EventDecor({ variant }: { variant: 'map' | 'wiki' }) {
  const decor = useEventDecor();
  const holiday = HOLIDAYS.find((k) => decor?.[k]) ?? null;
  return (
    <>
      {decor?.halloween && <HalloweenLayer variant={variant} on />}
      {decor?.noel && <NoelLayer variant={variant} on />}
      {holiday && <HolidayLayer variant={variant} which={holiday} />}
      {decor?.grande_chasse && <ChasseLayer variant={variant} />}
    </>
  );
}
