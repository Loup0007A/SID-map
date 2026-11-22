'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppsLauncher from './AppsLauncher';
import { useGuide } from '@/components/guide/GuideProvider';
import { SidIcon } from "@/components/icons/SidIcon";
import { BoutonRechercheCommune } from '@/components/RechercheCommune';

const LINKS = [{ href: '/carte', label: 'Carte du monde' }];
const STORAGE_KEY = 'sid-navbar-collapsed';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const guide = useGuide();

  // La visite guidée pointe des boutons de cette barre : on la déplie.
  const forceOpen = guide.tourRunning;

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

  if (collapsed && !forceOpen) {
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
    <>
    <nav className="site-bar anim-fade relative z-40 flex h-14 shrink-0 items-center justify-between gap-1.5 px-2 sm:gap-2 sm:px-3 md:px-4">

      <Link href="/carte" className="shrink-0 font-display text-[1.05rem] text-paper md:text-[1.2rem]">
        <span className="brand-mark flex items-center gap-2.5">
          <span aria-hidden className="brand-seal">✦</span>
          <span className="hidden min-[430px]:inline md:hidden">Cartographie</span>
          <span className="hidden md:inline">Cartographie du S.I.D.</span>
        </span>
      </Link>

      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-1.5">
        <button
          onClick={() => setAppsOpen(true)}
          data-guide="apps"
          className="btn-accent shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 font-display text-[0.95rem] leading-none text-paper sm:px-3 md:px-3.5"
        >
          <span className="sm:hidden">Applis</span>
          <span className="hidden sm:inline">Applications</span>
        </button>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-1.5 font-display text-[0.95rem] leading-none sm:px-3 transition ${
              pathname === l.href
                ? 'nav-current hidden md:inline-block'
                : 'hidden text-paper/75 hover:text-accent md:inline-block'
            }`}
          >
            {l.label}
          </Link>
        ))}
        {/* Lot 97 : carnet de voyage (visible aussi sur téléphone). */}
        <Link
          href="/carnet"
          className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-1.5 font-display text-[0.95rem] leading-none sm:px-3 transition ${
            pathname === '/carnet' ? 'nav-current' : 'text-paper/75 hover:text-accent'
          }`}
        >
          Carnet<span className="hidden lg:inline"> de voyage</span>
        </Link>
        {/* Lot 96 : recherche sur les trois sites (Ctrl+K). */}
        <BoutonRechercheCommune className="nav-btn flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1.5 font-display text-[0.95rem] leading-none sm:px-3" />
        <button
          onClick={() => guide.openHelp()}
          data-guide="help"
          className="nav-btn shrink-0 whitespace-nowrap rounded-md px-1.5 py-1.5 font-display text-[0.95rem] leading-none sm:px-3"
        >
          ?<span className="hidden md:inline"> Aide</span>
        </button>
        <button
          onClick={logout}
          aria-label="Déconnexion"
          title="Déconnexion"
          className="nav-btn shrink-0 sm:ml-1 whitespace-nowrap rounded-md px-1.5 py-1.5 font-display text-[0.95rem] leading-none sm:px-3"
        >
          <span className="md:hidden" aria-hidden>
            <SidIcon name="power" />
          </span>
          <span className="hidden md:inline">Déconnexion</span>
        </button>
        <button
          onClick={toggle}
          title="Replier la barre de navigation"
          className="flex h-7 w-6 shrink-0 items-center sm:ml-1 sm:w-7 justify-center rounded-lg text-paper/65 hover:bg-white/10 hover:text-accent"
        >
          ▴
        </button>
      </div>
    </nav>
    {appsOpen && <AppsLauncher onClose={() => setAppsOpen(false)} />}
    </>
  );
}
