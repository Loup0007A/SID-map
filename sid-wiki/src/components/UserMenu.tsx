'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from './Icon';

/** Menu unique (ordinateur) : hasard, tags, aide, admin, déconnexion. */
export default function UserMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'flex items-center gap-2 rounded-xl px-3 py-2 text-left font-typewriter text-sm font-bold text-olive-800 hover:bg-white/10';

  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn-ghost !min-h-[2.5rem] !px-3" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Menu">
        <Icon name="menu" />
      </button>
      {open && (
        <div role="menu" onClick={() => setOpen(false)} className="absolute right-0 top-full z-50 mt-2 flex w-56 flex-col rounded-2xl border border-white/20 bg-[#0b1730] p-2 shadow-2xl shadow-black/60">
          <Link href="/hasard" className={item} role="menuitem">
            <Icon name="hasard" /> Fiche au hasard
          </Link>
          <Link href="/tags" className={item} role="menuitem">
            <Icon name="tags" /> Tags
          </Link>
          <Link href="/aide" className={item} role="menuitem">
            <Icon name="aide" /> Aide
          </Link>
          {isAdmin && (
            <Link href="/admin" className={`${item} text-brass-300`} role="menuitem">
              <Icon name="admin" /> Dashboard admin
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className={`${item} mt-1 border-t border-white/10 pt-3`}
            onClick={async () => {
              await createClient().auth.signOut();
              router.replace('/login');
              router.refresh();
            }}
          >
            ⏻ Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
