import type { SupabaseClient } from '@supabase/supabase-js';

/** Supprime du Storage un fichier à partir de son URL publique (sans effet si l'URL n'est pas celle du bucket). */
export async function removeStoredFile(supabase: SupabaseClient, bucket: string, url: string | null | undefined) {
  if (!url) return;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  await supabase.storage.from(bucket).remove([path]);
}
