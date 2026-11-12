import { Suspense } from 'react';
import WorldMap from '@/components/map/WorldMap';
import { getBrand } from '@/lib/brand-server';

export default async function CartePage() {
  await getBrand();
  return (
    // « contents » : la zone principale n'ajoute aucune boîte autour de la carte.
    <main id="contenu" className="contents">
      <h1 className="sr-only">Carte du monde du S.I.D.</h1>
      <Suspense fallback={null}>
        <WorldMap />
      </Suspense>
    </main>
  );
}
