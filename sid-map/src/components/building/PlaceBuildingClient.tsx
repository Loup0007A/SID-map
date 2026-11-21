'use client';

import InteriorPage from './InteriorPage';

/** Intérieur d'un lieu-bâtiment de la carte du monde (Lot 92 : voir InteriorPage). */
export default function PlaceBuildingClient({ placeId }: { placeId: string }) {
  return <InteriorPage kind="place" id={placeId} />;
}
