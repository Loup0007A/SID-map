'use client';

/**
 * Trajets programmés (Lot 102, migration 0123) : ceux qui vont partir, avec
 * l'heure de départ à la seconde, et ceux des 7 derniers jours (partis,
 * annulés, échoués) avec le message du serveur.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMinutes } from '@/lib/travel';

type Trajet = {
  id: string;
  plan: { vol_vers?: string; pause_minutes?: number; route_id?: string }[];
  depart_at: string;
  arrivee_voulue: string | null;
  arrivee_estimee: string;
  minutes_estimees: number;
  statut: 'programme' | 'lance' | 'annule' | 'echoue';
  depart_reel: string | null;
  message: string | null;
  from: string | null;
  to: string | null;
};

const heure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const STATUT: Record<Trajet['statut'], { label: string; cls: string }> = {
  programme: { label: 'Programmé', cls: 'text-accent' },
  lance: { label: 'Parti', cls: 'text-green-300' },
  annule: { label: 'Annulé', cls: 'text-paper/55' },
  echoue: { label: 'Pas parti', cls: 'text-red-300' }
};

export default function ScheduledTrips({ refreshKey = 0 }: { refreshKey?: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [liste, setListe] = useState<Trajet[] | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('mes_trajets_programmes');
    if (!error) setListe((data as Trajet[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    charger();
  }, [charger, refreshKey]);
  useEffect(() => {
    if (refreshKey > 0) setOuvert(true);
  }, [refreshKey]);

  async function annuler(id: string) {
    setErreur(null);
    setOccupe(id);
    const { error } = await supabase.rpc('trajet_annuler', { p_id: id });
    setOccupe(null);
    if (error) setErreur(error.message);
    charger();
  }

  if (!liste || liste.length === 0) return null;
  const aVenir = liste.filter((t) => t.statut === 'programme').length;

  return (
    <div className="border-t border-white/10 pt-2">
      <button onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="flex w-full items-center justify-between text-left text-xs text-paper/85">
        <span>
          Mes trajets programmés {aVenir > 0 && <span className="text-accent">({aVenir} à venir)</span>}
        </span>
        <span aria-hidden>{ouvert ? '▾' : '▸'}</span>
      </button>
      {ouvert && (
        <ul className="mt-2 space-y-2">
          {liste.map((t) => {
            const s = STATUT[t.statut];
            const pauses = t.plan.filter((x) => x.pause_minutes).length;
            const vol = t.plan.some((x) => x.vol_vers);
            return (
              <li key={t.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[11px] text-paper/75">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-paper/90">
                    {vol ? '🕊️ ' : ''}
                    {t.from ?? '?'} → {t.to ?? '?'}
                  </span>
                  <span className={s.cls}>{s.label}</span>
                </p>
                <p>Départ {heure(t.depart_reel ?? t.depart_at)}</p>
                <p>
                  Arrivée {t.statut === 'programme' ? 'prévue ' : ''}
                  {heure(t.arrivee_estimee)} · {formatMinutes(Number(t.minutes_estimees))}
                  {pauses > 0 ? `, ${pauses} pause${pauses > 1 ? 's' : ''}` : ''}
                </p>
                {t.arrivee_voulue && t.statut === 'programme' && <p className="text-paper/55">Départ calculé pour arriver le {heure(t.arrivee_voulue)}</p>}
                {t.message && <p className="text-paper/60">{t.message}</p>}
                {t.statut === 'programme' && (
                  <button onClick={() => annuler(t.id)} disabled={occupe === t.id} className="mt-1 text-accent underline disabled:opacity-40">
                    {occupe === t.id ? 'Annulation…' : 'Annuler'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {erreur && <p role="alert" className="mt-1 text-[11px] text-red-300">{erreur}</p>}
    </div>
  );
}
