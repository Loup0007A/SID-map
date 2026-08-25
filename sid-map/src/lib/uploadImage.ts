import { createClient } from '@/lib/supabase/client';

export async function uploadMapImage(file: File, folder: string): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split('.').pop();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from('map-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });

  if (error) {
    console.error('Upload error', error);
    return null;
  }

  const { data } = supabase.storage.from('map-images').getPublicUrl(path);
  return data.publicUrl;
}
