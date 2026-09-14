'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const LINKS = [{ href: '/carte', label: 'Carte du monde' }];
const STORAGE_KEY = 'sid-navbar-collapsed';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (collapsed) {
    return (
      <div className="relative z-40 flex h-4 shrink-0 items-center justify-center">
        <button
          onClick={toggle}
          title="Afficher la barre de navigation"
          className="glass flex h-5 w-10 items-center justify-center rounded-b-lg text-paper/60 hover:text-accent"
        >
          ▾
        </button>
      </div>
    );
  }

  return (
    <nav className="relative z-40 flex h-14 shrink-0 items-center justify-between gap-2 glass-strong px-3 md:px-4">
      <div className="stamp-bar absolute bottom-0 left-0 h-[2px] w-full" />

      <Link href="/carte" className="shrink-0 font-display text-[10px] uppercase tracking-widest2 text-accent md:text-[11px]">
        <span className="md:hidden">S.I.D.</span>
        <span className="hidden md:inline">S.I.D. — Cartographie</span>
      </Link>

      <div className="flex items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-1.5">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-display text-[11px] uppercase tracking-wide transition md:px-3 md:text-xs ${
              pathname === l.href
                ? 'bg-accent/20 text-accent'
                : 'text-paper/70 hover:bg-white/10 hover:text-accent'
            }`}
          >
            {l.label}
          </Link>
        ))}
        <button
          onClick={logout}
          className="ml-1 shrink-0 whitespace-nowrap rounded-lg border border-white/15 px-2.5 py-1.5 font-display text-[11px] text-paper/60 transition hover:border-accent hover:text-accent md:px-3 md:text-xs"
        >
          Déconnexion
        </button>
        <button
          onClick={toggle}
          title="Replier la barre de navigation"
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-paper/50 hover:bg-white/10 hover:text-accent"
        >
          ▴
        </button>
      </div>
    </nav>
  );
}
