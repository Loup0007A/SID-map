import type { NextRequest } from 'next/server';

/**
 * Lecture du cookie de session Supabase sans appel réseau (middleware).
 * Sert seulement à savoir s'il faut rafraîchir le jeton : les données, elles,
 * restent protégées par la base (RLS), qui vérifie le jeton à chaque requête.
 */
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

function base64UrlToText(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Expiration (en secondes) du jeton de session : `null` s'il n'y a aucun
 * cookie de session, `0` s'il y en a un mais illisible.
 */
export function sessionExpiry(request: NextRequest): number | null {
  const all = request.cookies.getAll().filter((c) => AUTH_COOKIE.test(c.name) && c.value);
  if (!all.length) return null;
  const base = all[0].name.replace(/\.\d+$/, '');
  const whole = all.find((c) => c.name === base);
  let raw = whole
    ? whole.value
    : all
        .filter((c) => c.name.startsWith(base + '.'))
        .sort((a, b) => Number(a.name.slice(base.length + 1)) - Number(b.name.slice(base.length + 1)))
        .map((c) => c.value)
        .join('');
  try {
    raw = raw.startsWith('base64-') ? base64UrlToText(raw.slice(7)) : decodeURIComponent(raw);
    const s = JSON.parse(raw);
    if (typeof s?.expires_at === 'number') return s.expires_at;
    const token = typeof s?.access_token === 'string' ? s.access_token : Array.isArray(s) ? s[0] : null;
    if (typeof token === 'string') {
      const exp = JSON.parse(base64UrlToText(token.split('.')[1])).exp;
      if (typeof exp === 'number') return exp;
    }
  } catch {
    /* illisible : Supabase tranchera */
  }
  return 0;
}

/** Jeton encore valable au moins `marginSec` secondes. */
export function sessionStillFresh(exp: number | null, marginSec = 120) {
  return exp !== null && exp - Date.now() / 1000 > marginSec;
}
