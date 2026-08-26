'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import CommentsBox from '@/components/map/CommentsBox';
import OwnerPicker from './OwnerPicker';
import type { CityBuilding } from '@/lib/types';
import { BUILDING_LABELS } from '@/lib/types';

export default function BuildingDetailPanel({
  building,
  onClose,
  onDeleted
}: {
  building: CityBuilding;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [ownerId, setOwnerId] = useState(building.owner_id);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Supprimer "${building.name || BUILDING_LABELS[building.type]}" et tous ses étages ?`))
      return;
    await supabase.from('city_buildings').delete().eq('id', building.id);
    onClose();
    onDeleted?.();
  }

  async function assignOwner(id: string | null, label: string | null) {
    await supabase.from('city_buildings').update({ owner_id: id }).eq('id', building.id);
    setOwnerId(id);
    setOwnerLabel(label);
    setShowOwnerPicker(false);
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

      {building.image_url && (
        <img
          src={building.image_url}
          alt={building.name ?? ''}
          className="mb-4 h-40 w-full rounded-xl object-cover"
        />
      )}

      <p className="text-xs uppercase tracking-wide text-accent">{BUILDING_LABELS[building.type]}</p>
      <h2 className="font-display text-2xl">{building.name || BUILDING_LABELS[building.type]}</h2>

      <p className="mt-3 whitespace-pre-wrap text-sm text-paper/80">
        {building.description || 'Aucune description pour le moment.'}
      </p>

      {building.type === 'maison' && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm">
          <p className="text-[10px] uppercase tracking-wide text-paper/40">Propriétaire</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-paper/90">{ownerLabel ?? (ownerId ? 'Membre assigné' : 'Aucun')}</span>
            {canEdit && (
              <button
                onClick={() => setShowOwnerPicker(true)}
                className="shrink-0 rounded-lg border border-accent/40 px-2 py-1 text-xs text-accent hover:bg-accent/10"
              >
                Réattribuer
              </button>
            )}
          </div>
        </div>
      )}

      <Link
        href={`/batiment/${building.id}`}
        className="btn-accent mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-paper"
      >
        Voir les plans →
      </Link>

      <div className="mt-6 border-t border-white/10 pt-4">
        <CommentsBox targetType="building" targetId={building.id} />
      </div>

      {showOwnerPicker && (
        <OwnerPicker
          currentOwnerId={ownerId}
          onClose={() => setShowOwnerPicker(false)}
          onSelect={assignOwner}
        />
      )}
    </aside>
  );
}
