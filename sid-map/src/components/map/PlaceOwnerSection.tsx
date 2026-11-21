'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SidIcon } from '@/components/icons/SidIcon';
import OwnerPicker from '@/components/city/OwnerPicker';
import { displayName } from '@/lib/memberName';

/** Nom affiché d'un membre (roster), ou null. */
export function useMemberLabel(id: string | null | undefined) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return setLabel(null);
    let off = false;
    createClient()
      .rpc('list_roster')
      .then(({ data }) => {
        const m = ((data as { id: string }[]) ?? []).find((p) => p.id === id);
        if (!off) setLabel(m ? displayName(m) : null);
      });
    return () => {
      off = true;
    };
  }, [id]);
  return label;
}

/**
 * Propriétaire d'un lieu-bâtiment (migration 0120). La gestion de la carte
 * le donne ou le reprend ; le propriétaire aménage l'intérieur.
 */
export default function PlaceOwnerSection({
  placeId,
  ownerId: initial,
  canEdit,
  myUserId,
  onChanged,
  compact = false,
}: {
  placeId: string;
  ownerId: string | null | undefined;
  canEdit: boolean;
  myUserId?: string | null;
  onChanged?: (ownerId: string | null) => void;
  compact?: boolean;
}) {
  const [ownerId, setOwnerId] = useState<string | null>(initial ?? null);
  const label = useMemberLabel(ownerId);
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setOwnerId(initial ?? null), [initial]);

  async function assign(id: string | null) {
    setErr(null);
    const { error } = await createClient().rpc('map_place_owner_set', { p_place: placeId, p_owner: id });
    setPicking(false);
    if (error) return setErr(error.message);
    setOwnerId(id);
    onChanged?.(id);
  }

  if (!ownerId && !canEdit) return null;
  const mine = !!ownerId && ownerId === myUserId;
  return (
    <div className={`owner-card ${compact ? 'is-compact' : ''}`}>
      <span className="owner-seal" aria-hidden>
        <SidIcon name="home" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="section-label">Propriétaire</p>
        <p className="truncate font-semibold">
          {ownerId ? (mine ? 'Toi' : label ?? 'Membre') : 'Personne'}
        </p>
        {mine && <p className="text-xs opacity-75">Tu peux aménager les étages, la description et l&apos;image.</p>}
      </div>
      {canEdit && (
        <button onClick={() => setPicking(true)} className="btn-ghost shrink-0 rounded-lg px-2.5 py-1 text-xs">
          {ownerId ? 'Changer' : 'Donner à…'}
        </button>
      )}
      {err && <p className="basis-full text-xs text-accent">{err}</p>}
      {picking && <OwnerPicker currentOwnerId={ownerId} onClose={() => setPicking(false)} onSelect={(id) => assign(id)} />}
    </div>
  );
}
