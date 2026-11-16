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
