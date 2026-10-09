'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermission } from '@/lib/hooks/usePermission';
import { APPS, CATEGORIES, openApp, type AppCategory } from '@/lib/apps';
import AppIcon from './AppIcon';

// Panneau « Applications » ouvert depuis la barre du haut.
export default function AppsLauncher({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { allowed: isAdmin } = usePermission('manage_map');
  const [cat, setCat] = useState<AppCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const categories = CATEGORIES.filter((c) => !c.adminOnly || isAdmin);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return APPS.filter((a) => (!a.adminOnly || isAdmin) && (cat === 'all' || a.category === cat) &&
      (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)));
  }, [cat, query, isAdmin]);

  function launch(id: string) {
    onClose();
    if (pathname === '/carte') openApp(id);
    else router.push(`/carte?app=${id}`);
  }

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-display text-[11px] uppercase tracking-wide transition ${
      active ? 'bg-accent text-paper' : 'border border-white/15 text-paper/70 hover:text-accent'
    }`;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong absolute inset-x-2 top-16 mx-auto flex max-h-[calc(100dvh-5rem)] max-w-3xl flex-col overflow-hidden rounded-2xl md:top-16"
      >
        <div className="stamp-bar h-1 shrink-0" />
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          <h2 className="font-display text-sm uppercase tracking-wide text-accent">▦ Applications</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="glass-input ml-auto w-40 rounded-lg px-3 py-1.5 text-xs outline-none md:w-56"
          />
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-paper/50 hover:bg-white/10 hover:text-accent">
            ✕
          </button>
        </div>

        <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setCat('all')} className={chip(cat === 'all')}>
            Tout
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={chip(cat === c.id)}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 scrollbar-thin">
          {visible.length === 0 && <p className="py-6 text-center text-sm text-paper/50">Aucune application.</p>}
          {categories
            .filter((c) => visible.some((a) => a.category === c.id))
            .map((c) => (
              <section key={c.id}>
                {cat === 'all' && (
                  <h3 className="mb-2 text-[11px] uppercase tracking-wide text-paper/50">
                    {c.emoji} {c.label}
                  </h3>
                )}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {visible
                    .filter((a) => a.category === c.id)
                    .map((a) => (
                      <button
                        key={a.id}
                        onClick={() => launch(a.id)}
                        title={a.description}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2.5 text-center transition hover:border-accent hover:bg-accent/10"
                      >
                        <AppIcon id={a.id} emoji={a.emoji} />
                        <span className="text-[11px] leading-tight text-paper/90">{a.name}</span>
                      </button>
                    ))}
                </div>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}
