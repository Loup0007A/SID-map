'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import type { Point } from '@/lib/types';

export default function ReliefFormModal({
  points,
  onClose,
  onSaved
}: {
  points: Point[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [elevation, setElevation] = useState(50);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('map_relief').insert({
      path_points: points,
      elevation,
      created_by: user?.id ?? null
    });

    setSaving(false);
    if (error) showToast('Impossible de créer ce relief.', 'error');
    else {
      showToast('Relief ajouté.');
      onSaved();
    }
  }

  return (
    <Modal title="Nouveau relief" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50">
            <span>
              Altitude ({elevation < 0 ? 'dépression' : elevation === 0 ? 'niveau de la mer' : 'élévation'})
            </span>
            <span className="text-accent">{elevation}</span>
          </label>
          <input
            type="range"
            min={-100}
            max={100}
            value={elevation}
            onChange={(e) => setElevation(Number(e.target.value))}
            className="w-full accent-[#b3261e]"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Créer'}
        </button>
      </div>
    </Modal>
  );
}
