'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HORS_LIGNE_EVENT, viderHorsLigne, type EtatHorsLigne } from '@/lib/horsLigne';

/**
 * Carto hors ligne (Lot 96) : installe le service worker et affiche un
 * bandeau quand la carte montre la dernière copie gardée.
 */
export default function HorsLigne() {
  const [etat, setEtat] = useState<EtatHorsLigne>({ horsLigne: false, date: null });

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-carto.js', { scope: '/' }).catch(() => undefined);
    }
    const onEtat = (e: Event) => {
      const d = (e as CustomEvent<EtatHorsLigne>).detail;
      // La date la plus ancienne des copies affichées.
      setEtat((old) => (d.horsLigne ? { horsLigne: true, date: old.horsLigne && old.date && d.date ? Math.min(old.date, d.date) : d.date } : old.horsLigne && navigator.onLine ? { horsLigne: false, date: null } : old));
    };
    const onOffline = () => setEtat((old) => ({ horsLigne: true, date: old.date }));
    const onOnline = () => setEtat({ horsLigne: false, date: null });
    window.addEventListener(HORS_LIGNE_EVENT, onEtat);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (!navigator.onLine) onOffline();
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') viderHorsLigne();
    });
    return () => {
      window.removeEventListener(HORS_LIGNE_EVENT, onEtat);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      data.subscription.unsubscribe();
    };
  }, []);

  if (!etat.horsLigne) return null;
  const quand = etat.date
    ? new Date(etat.date).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <div role="status" className="hors-ligne">
      <strong>Hors ligne</strong>
      {quand ? <> : données du {quand}.</> : <> : pas de réseau.</>} Les trajets et achats reprendront avec le réseau.
    </div>
  );
}
