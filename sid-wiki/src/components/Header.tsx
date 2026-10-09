import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import UserMenu from './UserMenu';
import Icon from './Icon';
import MobileNav from './MobileNav';
import SearchBox from './SearchBox';
import DesktopNav from './DesktopNav';

export function HeaderView({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/15 bg-[#050912]/60 pt-[env(safe-area-inset-top)] shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4">
          {/* Ligne 1 : logo — recherche — favoris + menu */}
          <div className="flex items-center gap-4 py-2.5 md:py-3">
            <Link href="/" className="flex flex-none items-center gap-2 font-typewriter text-xl font-extrabold text-white md:text-2xl">
              <Icon name="logo" /> <span>Wiki du <span className="rounded-lg bg-brass-400 px-2 text-night">S.I.D.</span></span>
            </Link>

            {signedIn && (
              <>
                <div className="hidden min-w-0 flex-1 justify-center md:flex">
                  <div className="w-full max-w-xl">
                    <SearchBox />
                  </div>
                </div>

                <div className="ml-auto hidden flex-none items-center gap-2 md:flex">
                  <Link href="/favoris" className="btn-ghost !min-h-[2.5rem] !px-3" title="Mes favoris" aria-label="Mes favoris">
                    <Icon name="favoris" />
                  </Link>
                  <UserMenu isAdmin={isAdmin} />
                </div>
              </>
            )}
          </div>

          {/* Ligne 2 : catégories */}
          {signedIn && <DesktopNav />}
        </div>
      </header>

      {signedIn && <MobileNav isAdmin={isAdmin} />}
    </>
  );
}

export default async function Header() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase.rpc('wiki_is_admin');
    isAdmin = data === true;
  }

  return <HeaderView signedIn={!!user} isAdmin={isAdmin} />;
}
