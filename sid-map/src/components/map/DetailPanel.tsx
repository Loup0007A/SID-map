'use client';

import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import CommentsBox from './CommentsBox';
import type { MapPlace, MapZone } from '@/lib/types';
import { PLACE_LABELS, ZONE_LABELS } from '@/lib/types';

export default function DetailPanel({
  entity,
  kind,
  onClose,
  onDeleted
}: {
  entity: MapZone | MapPlace;
  kind: 'zone' | 'place';
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');

  const label =
    kind === 'zone' ? ZONE_LABELS[(entity as MapZone).type] : PLACE_LABELS[(entity as MapPlace).type];
  const isCity = kind === 'place' && (entity as MapPlace).type === 'ville';

  async function handleDelete() {
    const confirmMsg =
      kind === 'zone'
        ? `Supprimer la zone "${entity.name}" ? Les lieux qu'elle contient seront détachés (pas supprimés).`
        : `Supprimer "${entity.name}" ? ${isCity ? 'Tous ses quartiers et bâtiments seront supprimés aussi.' : ''}`;
    if (!confirm(confirmMsg)) return;

    const table = kind === 'zone' ? 'map_zones' : 'map_places';
    await supabase.from(table).delete().eq('id', entity.id);
    onClose();
    onDeleted?.();
  }

  return (
    <aside className="fixed right-0 top-0 z-30 h-full w-full max-w-sm overflow-y-auto scrollbar-thin glass-strong rounded-l-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-paper/60 hover:text-accent">
          ✕ Fermer
        </button>
        {canEdit && (
          <button
            onClick={handleDelete}
            className="rounded-lg border border-accent/40 px-2.5 py-1 text-xs text-accent hover:bg-accent/10"
          >
            🗑 Supprimer
          </button>
        )}
      </div>

      {entity.image_url && (
        <img
          src={entity.image_url}
          alt={entity.name}
          className="mb-4 h-40 w-full rounded-xl object-cover"
        />
      )}

      <p className="text-xs uppercase tracking-wide text-accent">{label}</p>
      <h2 className="font-display text-2xl">{entity.name}</h2>

      <p className="mt-3 whitespace-pre-wrap text-sm text-paper/80">
        {entity.description || 'Aucune description pour le moment.'}
      </p>

      {isCity && (
        <Link
          href={`/ville/${entity.id}`}
          className="btn-accent mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-paper"
        >
          Entrer dans la ville →
        </Link>
      )}

      <div className="mt-6 border-t border-white/10 pt-4">
        <CommentsBox targetType={kind} targetId={entity.id} />
      </div>
    </aside>
  );
}
