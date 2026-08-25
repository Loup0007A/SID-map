'use client';

import Link from 'next/link';
import CommentsBox from './CommentsBox';
import type { MapPlace, MapZone } from '@/lib/types';
import { PLACE_LABELS, ZONE_LABELS } from '@/lib/types';

export default function DetailPanel({
  entity,
  kind,
  onClose
}: {
  entity: MapZone | MapPlace;
  kind: 'zone' | 'place';
  onClose: () => void;
}) {
  const label =
    kind === 'zone' ? ZONE_LABELS[(entity as MapZone).type] : PLACE_LABELS[(entity as MapPlace).type];
  const isCity = kind === 'place' && (entity as MapPlace).type === 'ville';

  return (
    <aside className="fixed right-0 top-0 z-30 h-full w-full max-w-sm overflow-y-auto scrollbar-thin border-l border-gold/30 bg-ink/95 p-5 backdrop-blur">
      <button onClick={onClose} className="mb-4 text-sm text-parchment/60 hover:text-gold">
        ✕ Fermer
      </button>

      {entity.image_url && (
        <img
          src={entity.image_url}
          alt={entity.name}
          className="mb-4 h-40 w-full rounded object-cover"
        />
      )}

      <p className="text-xs uppercase tracking-wide text-gold">{label}</p>
      <h2 className="font-display text-2xl">{entity.name}</h2>

      <p className="mt-3 whitespace-pre-wrap text-sm text-parchment/80">
        {entity.description || 'Aucune description pour le moment.'}
      </p>

      {isCity && (
        <Link
          href={`/ville/${entity.id}`}
          className="mt-4 inline-block rounded bg-gold px-4 py-2 text-sm font-semibold text-ink hover:brightness-110"
        >
          Entrer dans la ville →
        </Link>
      )}

      <div className="mt-6 border-t border-parchment/10 pt-4">
        <CommentsBox targetType={kind} targetId={entity.id} />
      </div>
    </aside>
  );
}
