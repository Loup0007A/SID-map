'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { currentUser } from '@/lib/supabase/session';
import { TERMS_VERSION } from './LegalContent';

/**
 * Demande d'accepter les CGU et la politique de confidentialité (communes
 * aux trois sites du S.I.D. : l'acceptation vaut partout). Petite carte
 * flottante, pour ne pas cacher la carte.
 */
// Membre dont on sait déjà que les conditions sont acceptées (pour cette visite) :
// pas de nouvelle requête à chaque changement de page.
let termsOkFor: string | null = null;

export default function TermsBanner() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pathname.startsWith('/login') || pathname.startsWith('/cgu') || pathname.startsWith('/confidentialite')) return;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await currentUser();
      if (!user || termsOkFor === user.id) return;
      const { data, error } = await supabase.from('profiles').select('terms_version').eq('id', user.id).maybeSingle();
      if (!error && data && data.terms_version !== TERMS_VERSION) setShow(true);
      else if (!error && data) termsOkFor = user.id;
    })();
  }, [pathname]);

  if (!show) return null;

  async function accept() {
    setBusy(true);
    const { error } = await createClient().rpc('accept_terms', { p_version: TERMS_VERSION });
    setBusy(false);
    if (!error) {
      setShow(false);
      termsOkFor = (await currentUser()).data.user?.id ?? null;
    }
  }

  return (
    <div className="glass-strong fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-[60] mx-auto max-w-xl rounded-2xl p-4 text-sm text-paper/90 shadow-xl">
      <p>
        📜 Le S.I.D. a des conditions d&apos;utilisation et une politique de confidentialité, communes au Dossier Central, à la
        Cartographie et au Wiki. Lis{' '}
        <Link href="/cgu" className="text-accent underline">les conditions</Link> et{' '}
        <Link href="/confidentialite" className="text-accent underline">ce que nous faisons de tes données</Link>.
      </p>
      <button
        onClick={accept}
        disabled={busy}
        className="btn-accent mt-3 w-full rounded-lg py-2 font-display text-xs uppercase tracking-wide text-paper disabled:opacity-50"
      >
        {busy ? '…' : "J'ai lu et j'accepte"}
      </button>
    </div>
  );
}
