'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BRAND, brandFromConfig, setBrand } from '@/lib/brand';

// Pages toujours ouvertes : connexion (l'équipe doit pouvoir entrer) et pages légales.
const OPEN_PATHS = ['/login', '/cgu', '/confidentialite'];

/**
 * Cartographie fermée depuis le Dossier Central (Modération → Sites et
 * rubriques, Lot 78) : les membres voient « Site fermé ». L'équipe (Gérer les
 * comptes, ou manage_map) entre encore, avec un bandeau.
 */
export default function SiteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(BRAND.sites.map);
  const [staff, setStaff] = useState<boolean | null>(null);

  // Le serveur garde la configuration quelques minutes : on la relit.
  useEffect(() => {
    createClient()
      .rpc('public_config')
      .then(({ data, error }) => {
        if (error || !data) return;
        setBrand(brandFromConfig(data as Record<string, unknown>));
        setOpen(BRAND.sites.map);
      });
  }, []);

  useEffect(() => {
    if (open || staff !== null) return;
    let alive = true;
    (async () => {
      const sb = createClient();
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user.id;
      let ok = false;
      if (uid) {
        const res = await Promise.all(['manage_map', 'manage_users'].map((perm) => sb.rpc('has_permission', { uid, perm })));
        ok = res.some((r) => r.data === true);
      }
      if (alive) setStaff(ok);
    })();
    return () => {
      alive = false;
    };
  }, [open, staff]);

  if (open) return <>{children}</>;
  if (OPEN_PATHS.some((p) => pathname.startsWith(p))) {
    return (
      <>
        {pathname.startsWith('/login') && (
          <p className="fixed inset-x-0 top-0 z-[60] bg-[#3a2a12] px-4 py-2 text-center font-display text-[11px] uppercase tracking-wide text-[#f0c27a]">
            Site fermé aux membres pour le moment
          </p>
        )}
        {children}
      </>
    );
  }
  if (staff) {
    return (
      <>
        <p className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] bg-[#3a2a12]/90 px-4 py-1.5 text-center font-display text-[10px] uppercase tracking-wide text-[#f0c27a]">
          Site fermé aux membres (Dossier Central → Modération). Tu y entres grâce à tes droits.
        </p>
        {children}
      </>
    );
  }
  return (
    <main id="contenu" className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong w-full max-w-md overflow-hidden rounded-2xl">
        <div className="stamp-bar h-1.5 w-full" />
        <div className="space-y-3 p-6 text-center">
          <p className="font-display text-[10px] uppercase tracking-widest2 text-accent">S.I.D. — Cartographie</p>
          <h1 className="font-display text-xl uppercase tracking-wide text-paper">Site fermé</h1>
          <p className="text-sm text-paper/75">
            {staff === null ? 'Vérification…' : 'La carte n’est pas ouverte pour le moment.'}
          </p>
          <a
            href={`${BRAND.urls.site}/dashboard`}
            className="inline-block rounded-lg border border-accent/60 px-4 py-2 font-display text-xs uppercase tracking-wide text-accent hover:bg-accent/10"
          >
            Retour au Dossier Central
          </a>
        </div>
      </div>
    </main>
  );
}
