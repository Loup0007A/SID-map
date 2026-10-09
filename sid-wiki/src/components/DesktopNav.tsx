'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/wiki';
import Icon from './Icon';

/** Onglets des catégories (ordinateur) avec l'onglet actif mis en valeur. */
export default function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 pb-2 md:flex" aria-label="Catégories">
      {CATEGORIES.map((c) => {
        const active = pathname === `/${c}` || pathname.startsWith(`/${c}/`);
        return (
          <Link
            key={c}
            href={`/${c}`}
            className={`relative rounded-full px-4 py-1.5 font-typewriter text-base font-bold transition ${
              active ? 'bg-white/[0.14] text-white' : 'text-olive-800 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <Icon name={c} /> {CATEGORY_LABELS[c].label}
            {active && <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-brass-400" />}
          </Link>
        );
      })}
    </nav>
  );
}
