'use client';

import Link from 'next/link';
import CommentsBox from '@/components/map/CommentsBox';
import type { CityBuilding } from '@/lib/types';
import { BUILDING_LABELS } from '@/lib/types';

export default function BuildingDetailPanel({
  building,
  onClose
}: {
  building: CityBuilding;
  onClose: () => void;
}) {
  return (
    <aside className="fixed right-0 top-0 z-30 h-full w-full max-w-sm overflow-y-auto scrollbar-thin border-l border-accent/30 bg-ink/95 p-5 backdrop-blur">
      <button onClick={onClose} className="mb-4 text-sm text-paper/60 hover:text-accent">
        ✕ Fermer
      </button>

      {building.image_url && (
        <img
          src={building.image_url}
          alt={building.name ?? ''}
          className="mb-4 h-40 w-full  object-cover"
        />
      )}

      <p className="text-xs uppercase tracking-wide text-accent">{BUILDING_LABELS[building.type]}</p>
      <h2 className="font-display text-2xl">{building.name || BUILDING_LABELS[building.type]}</h2>

      <p className="mt-3 whitespace-pre-wrap text-sm text-paper/80">
        {building.description || 'Aucune description pour le moment.'}
      </p>

      <Link
        href={`/batiment/${building.id}`}
        className="mt-4 inline-block  bg-accent px-4 py-2 text-sm font-semibold text-ink hover:brightness-110"
      >
        Voir les plans →
      </Link>

      <div className="mt-6 border-t border-paper/10 pt-4">
        <CommentsBox targetType="building" targetId={building.id} />
      </div>
    </aside>
  );
}
