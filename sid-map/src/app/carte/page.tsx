import { Suspense } from 'react';
import WorldMap from '@/components/map/WorldMap';

export default function CartePage() {
  return (
    <Suspense fallback={null}>
      <WorldMap />
    </Suspense>
  );
}
