'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isCategory, pad, type Category } from '@/lib/wiki';
import Icon from './Icon';
import { RECENT_KEY, type Viewed } from './ViewTracker';

/** « Repris où tu t'étais arrêté » : fiches récemment consultées sur cet appareil. */
export default function RecentlyViewed() {
  const [items, setItems] = useState<Viewed[]>([]);

  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Viewed[];
      setItems(list.filter((v) => isCategory(v.category)).slice(0, 8));
    } catch {}
  }, []);

  if (items.length === 0) return null;

  function clear() {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}
    setItems([]);
  }

  return (
    <section className="card mt-4 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-typewriter text-xl font-bold text-olive-800">🕘 Consultées récemment</h2>
        <button type="button" className="text-xs text-olive-700 hover:underline" onClick={clear}>
          Effacer
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((v) => (
          <li key={`${v.category}${v.number}`}>
            <Link href={`/${v.category}/${pad(v.number)}`} className="btn-ghost !px-3 !py-1 text-sm">
              <Icon name={v.category as Category} /> {v.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
