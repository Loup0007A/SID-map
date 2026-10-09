'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { pad, type EntrySummary } from '@/lib/wiki';
import EntryCard from './EntryCard';
import Rarity from './Rarity';
import Icon from './Icon';

type Sort = 'number' | 'title' | 'rarity';
const KEY = 'wiki-category-view';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Liste d'une catégorie : filtre instantané, tri (n° / nom / rareté) et vue grille ou liste. */
export default function CategoryView({ entries }: { entries: EntrySummary[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('number');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      if (v.view === 'list' || v.view === 'grid') setView(v.view);
      if (v.sort === 'number' || v.sort === 'title' || v.sort === 'rarity') setSort(v.sort);
    } catch {}
  }, []);

  function persist(next: { view?: 'grid' | 'list'; sort?: Sort }) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ view, sort, ...next }));
    } catch {}
  }

  const shown = useMemo(() => {
    const f = norm(q.trim());
    let list = entries;
    if (f) {
      // Seules les fiches découvertes sont filtrables par texte (les autres restent « ? »)
      list = list.filter((e) => e.discovered && (norm(e.title ?? '').includes(f) || pad(e.number).includes(f) || (e.tags ?? []).some((t) => norm(t).includes(f))));
    }
    const sorted = [...list];
    if (sort === 'title') sorted.sort((a, b) => (a.discovered === b.discovered ? (a.title ?? '').localeCompare(b.title ?? '', 'fr') : a.discovered ? -1 : 1));
    else if (sort === 'rarity') sorted.sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0) || a.number - b.number);
    return sorted;
  }, [entries, q, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" className="input max-w-xs" placeholder="Filtrer cette liste…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          className="input !w-auto"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as Sort);
            persist({ sort: e.target.value as Sort });
          }}
          aria-label="Trier"
        >
          <option value="number">Tri : numéro</option>
          <option value="title">Tri : nom (A→Z)</option>
          <option value="rarity">Tri : rareté ★</option>
        </select>
        <span className="inline-flex overflow-hidden rounded-full border border-white/20" role="group" aria-label="Affichage">
          {(['grid', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                persist({ view: v });
              }}
              className={`px-3 py-1.5 text-sm font-bold ${view === v ? 'bg-brass-400 text-night' : 'hover:bg-white/10'}`}
              aria-pressed={view === v}
            >
              {v === 'grid' ? '▦ Cartes' : '☰ Liste'}
            </button>
          ))}
        </span>
        <span className="text-sm text-olive-700">{shown.length} fiche{shown.length > 1 ? 's' : ''}</span>
      </div>

      {shown.length === 0 ? (
        <p className="italic text-olive-700">Rien ici pour l’instant !</p>
      ) : view === 'grid' ? (
        <div className="stagger grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {shown.map((e) => (
            <EntryCard key={e.number} entry={e} />
          ))}
        </div>
      ) : (
        <ul className="card divide-y divide-white/10 overflow-hidden">
          {shown.map((e) => (
            <li key={e.number}>
              <Link href={`/${e.category}/${pad(e.number)}`} className="flex items-center gap-3 px-3 py-2 transition hover:bg-white/[0.06]">
                <span className="w-12 flex-none font-typewriter text-xs text-olive-700">N° {pad(e.number)}</span>
                {e.discovered && e.title ? (
                  <>
                    <span className="min-w-0 flex-1 truncate font-bold">{e.title}</span>
                    <Rarity value={e.rarity} className="hidden text-sm sm:inline" />
                    {e.has_model && <span className="rounded-full bg-kraft-500/30 px-2 text-[10px] font-bold">🎬 3D</span>}
                  </>
                ) : (
                  <span className="flex-1 text-xl font-extrabold text-olive-700/40">?</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
