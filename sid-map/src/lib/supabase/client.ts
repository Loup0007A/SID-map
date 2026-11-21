import { createBrowserClient } from '@supabase/ssr';
import { fetchHorsLigne } from '@/lib/horsLigne';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Lot 96 : lectures gardées pour la Carto hors ligne.
    { global: { fetch: fetchHorsLigne((...a) => fetch(...a)) } }
  );
}
