'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/wiki';
import Icon, { type IconName } from './Icon';

/** Barre d'onglets en bas + menu coulissant, affichés uniquement sur téléphone (< md). */
export default function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Ferme le menu à chaque navigation
  useEffect(() => setOpen(false), [pathname]);

  // Bloque le scroll de la page derrière le menu + Échap pour fermer
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tabs: { href: string; icon: IconName; label: string; active: boolean }[] = [
    { href: '/', icon: 'accueil', label: 'Accueil', active: pathname === '/' },
    { href: '/recherche', icon: 'chercher', label: 'Chercher', active: pathname.startsWith('/recherche') },
    { href: '/favoris', icon: 'favoris', label: 'Favoris', active: pathname.startsWith('/favoris') },
  ];

  async function signOut() {
    await createClient().auth.signOut();
    setOpen(false);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="md:hidden">
      {/* Menu coulissant */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/15 bg-[#0a1428]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-olive-800/30" />

            <form action="/recherche" className="mb-4">
              <input name="q" type="search" placeholder="🔍 Rechercher un monstre, un skill…" className="input !rounded-full" />
            </form>

            <h2 className="mb-2 font-typewriter text-sm font-bold text-olive-700">Le wiki</h2>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <Link
                  key={c}
                  href={`/${c}`}
                  className={`flex items-center gap-2 rounded-2xl border border-white/15 px-3 py-3 font-typewriter font-bold ${
                    pathname === `/${c}` || pathname.startsWith(`/${c}/`) ? 'bg-brass-400 text-night' : 'bg-white/[0.1] text-olive-800'
                  }`}
                >
                  <Icon name={c} className="text-xl" />
                  {CATEGORY_LABELS[c].label}
                </Link>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-bold">
              {([
                ['/hasard', 'hasard', 'Hasard'],
                ['/tags', 'tags', 'Tags'],
                ['/aide', 'aide', 'Aide'],
              ] as const).map(([href, icon, label]) => (
                <Link key={href} href={href} className="flex flex-col items-center gap-1 rounded-2xl border border-white/15 bg-white/[0.1] px-2 py-3 text-olive-800">
                  <Icon name={icon} className="text-xl" />
                  {label}
                </Link>
              ))}
            </div>

            {isAdmin && (
              <Link href="/admin" className="btn mt-3 w-full !min-h-[3rem]">
                <Icon name="admin" /> Dashboard admin
              </Link>
            )}

            <button className="btn-ghost mt-3 w-full !min-h-[3rem]" onClick={signOut}>
              Déconnexion
            </button>
          </div>
        </div>
      )}

      {/* Barre d'onglets */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#050912]/80 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        aria-label="Navigation principale"
      >
        <ul className="grid grid-cols-4">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                  t.active ? 'text-olive-700' : 'text-olive-800/70'
                }`}
              >
                <Icon name={t.icon} className="text-xl leading-none" />
                {t.label}
                {t.active && <span className="mt-0.5 h-1 w-6 rounded-full bg-brass-500" />}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-olive-800/70"
            >
              <Icon name="menu" className="text-xl leading-none" />
              Menu
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
