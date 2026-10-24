import { NextResponse, type NextRequest } from 'next/server';
import { sessionExpiry } from '@/lib/supabase/sessionCookie';

/**
 * Garde de la Cartographie : sans session, direction /login.
 *
 * Volontairement sans appel réseau (rapidité) : on regarde seulement si le
 * cookie de session est là. Toutes les pages de la carte se chargent dans le
 * navigateur, dont le client Supabase rafraîchit lui-même le jeton ; les
 * données restent protégées par la base (RLS). Avant, chaque page attendait
 * ici un aller-retour vers le serveur d'authentification de Supabase.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login');
  // Pages légales : lisibles sans être connecté.
  const isPublic = ['/cgu', '/confidentialite'].some((p) => pathname.startsWith(p));

  if (sessionExpiry(request) === null && !isAuthRoute && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  // (Déjà connecté sur /login : la page renvoie elle-même vers la carte.)
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|json)$).*)']
};
