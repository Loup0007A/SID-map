import { Suspense } from 'react';
import WorldMap from '@/components/map/WorldMap';

export default function CartePage() {
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
