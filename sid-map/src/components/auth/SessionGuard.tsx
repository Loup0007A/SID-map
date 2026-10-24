'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Session expirée et impossible à rafraîchir (déconnexion ailleurs, compte
 * supprimé…) : retour à la connexion. Lecture sur place, sans réseau, sauf
 * si le jeton doit être rafraîchi. Le middleware, lui, ne vérifie que la
 * présence du cookie.
 */
export default function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (pathname.startsWith('/login') || pathname.startsWith('/cgu') || pathname.startsWith('/confidentialite')) return;
    let alive = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (alive && !data.session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      });
    return () => {
      alive = false;
    };
  }, [pathname, router]);
  return null;
}
