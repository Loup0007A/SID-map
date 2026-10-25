'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermission } from '@/lib/hooks/usePermission';
import { APPS, CATEGORIES, openApp, type AppCategory } from '@/lib/apps';
import AppIcon from './AppIcon';
import { LegalLinks } from '@/components/legal/LegalPage';
import { useGuide } from '@/components/guide/GuideProvider';
import { Glyph } from '@/components/icons/SidIcon';

// Panneau « Applications » ouvert depuis la barre du haut.
export default function AppsLauncher({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { allowed: isAdmin } = usePermission('manage_map');
  const [cat, setCat] = useState<AppCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const guide = useGuide();

  const categories = CATEGORIES.filter((c) => !c.adminOnly || isAdmin);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return APPS.filter((a) => (!a.adminOnly || isAdmin) && (cat === 'all' || a.category === cat) &&
      (!q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)));
  }, [cat, query, isAdmin]);

  function launch(id: string) {
    onClose();
    if (id === 'help') return guide.openHelp();
    if (pathname === '/carte') openApp(id);
    else router.push(`/carte?app=${id}`);
  }

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-display text-[11px] uppercase tracking-wide transition ${
      active ? 'bg-accent text-paper' : 'border border-white/15 text-paper/70 hover:text-accent'
    }`;

  return (
    <div className="anim-fade fixed inset-0 z-50 bg-[#0a0f1a]/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-pop glass-strong absolute inset-x-2 top-16 mx-auto flex max-h-[calc(100dvh-5rem)] max-w-3xl flex-col overflow-hidden rounded-xl md:top-16"
      >
        <div className="stamp-bar h-px shrink-0" />
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          <h2 className="font-display text-[1.25rem] leading-none text-accent">Applications</h2>
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
              <Glyph e={c.emoji} /> {c.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 scrollbar-thin">
          {visible.length === 0 && <p className="py-6 text-center text-sm text-paper/50">Aucune application ne correspond à « {query} ».</p>}
          {categories
            .filter((c) => visible.some((a) => a.category === c.id))
            .map((c) => (
              <section key={c.id}>
                {cat === 'all' && (
                  <h3 className="mb-2.5 flex items-center gap-2 border-b border-accent/20 pb-1.5 font-display text-[1.05rem] text-accent">
                    <Glyph e={c.emoji} /> {c.label}
                  </h3>
                )}
                <div className="anim-stagger grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {visible
                    .filter((a) => a.category === c.id)
                    .map((a) => (
                      <button
                        key={a.id}
                        onClick={() => launch(a.id)}
                        title={a.description}
                        className="hover-lift flex flex-col items-center gap-1.5 rounded-lg border border-accent/15 bg-[#232e44] p-2.5 text-center hover:border-accent/60 hover:bg-[#28354e]"
                      >
                        <AppIcon id={a.id} emoji={a.emoji} />
                        <span className="font-serif text-[15px] font-bold leading-tight text-paper">{a.name}</span>
                        <span className="hidden text-[12.5px] leading-snug text-paper/55 sm:block">{a.description}</span>
                      </button>
                    ))}
                </div>
              </section>
            ))}
          <LegalLinks className="border-t border-white/10 pt-3" />
        </div>
      </div>
    </div>
  );
}
