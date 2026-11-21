import type { MetadataRoute } from 'next';
import { brandify } from '@/lib/brand';
import { getBrand } from '@/lib/brand-server';

// Noms tirés de app_config (Lot 77) : relus à chaque demande (gardés 5 minutes côté serveur).
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await getBrand();
  return {
    name: `${b.name} — ${b.map}`,
    short_name: brandify('S.I.D. Carte'),
    description: brandify('Carte interactive du monde RP de la S.I.D.'),
    start_url: '/carte',
    display: 'standalone',
    background_color: '#C4572B',
    theme_color: '#2A1408',
    orientation: 'any',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
