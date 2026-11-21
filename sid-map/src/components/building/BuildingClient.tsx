'use client';

import InteriorPage from './InteriorPage';

/** Intérieur d'un bâtiment de ville (Lot 92 : voir InteriorPage). */
export default function BuildingClient({ buildingId }: { buildingId: string }) {
  return <InteriorPage kind="building" id={buildingId} />;
}
