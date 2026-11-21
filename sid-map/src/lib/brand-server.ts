import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_BRAND, brandFromConfig, setBrand, type Brand } from '@/lib/brand';
import { primeGlitched, type GlitchedMember } from '@/lib/glitch';

/**
 * Identité du jeu côté serveur (Lot 77) : public_config (migration 0094 du
 * site principal), gardée 5 minutes. À n'appeler que depuis le serveur.
 */
const load = unstable_cache(
  async (): Promise<Brand> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return DEFAULT_BRAND;
    try {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await sb.rpc('public_config');
      if (error || !data) return DEFAULT_BRAND;
      return brandFromConfig(data as Record<string, unknown>);
    } catch {
      return DEFAULT_BRAND;
    }
  },
  ['public-config'],
  { revalidate: 300, tags: ['public-config'] }
);

// Membres en lieu inconnu (Lot 81, migration 0117 de la Cartographie) :
// gardés 20 secondes. Le navigateur relit la liste lui-même (GlitchSync).
const loadGlitched = unstable_cache(
  async (): Promise<GlitchedMember[]> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    try {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await sb.rpc('glitched_members');
      return !error && Array.isArray(data) ? (data as GlitchedMember[]) : [];
    } catch {
      return [];
    }
  },
  ['glitched-members'],
  { revalidate: 20, tags: ['glitched-members'] }
);

export async function getGlitched(): Promise<GlitchedMember[]> {
  const list = await loadGlitched();
  primeGlitched(list);
  return list;
}

/** Charge l'identité et la pose pour le rendu serveur. À attendre en tête de chaque page serveur. */
export async function getBrand(): Promise<Brand> {
  const [b] = await Promise.all([load(), getGlitched()]);
  setBrand(b);
  return b;
}

// Thème du fond (Lot 92, comme le Wiki) : l'évent affiché, décidé dès le rendu serveur.
// Même ordre que EventDecor ; l'élection prise par la force passe au rouge sang.
const THEME_ORDER = ['election', 'grande_chasse', 'noel', 'halloween', 'saint_valentin', 'poisson_avril', 'paques', 'premier_mai', 'fete_musique', 'quatorze_juillet', 'armistice'];
const loadTheme = unstable_cache(
  async (): Promise<string | null> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    try {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await sb.rpc('site_decor');
      if (error || !data) return null;
      const d = data as Record<string, unknown>;
      const t = THEME_ORDER.find((k) => d[k] === true) ?? null;
      if (t !== 'election') return t;
      const e = await sb.rpc('election_status');
      return (e.data as { mode?: string } | null)?.mode === 'force' ? 'election_force' : t;
    } catch {
      return null;
    }
  },
  ['site-decor-theme'],
  { revalidate: 300, tags: ['site-decor'] }
);

export async function getFondTheme(): Promise<string | null> {
  return loadTheme();
}
