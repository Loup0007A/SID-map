'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { BIOME_COLORS, BIOME_LABELS } from '@/lib/types';
import type { Point } from '@/lib/types';

export default function BiomeFormModal({
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
  const [biomeType, setBiomeType] = useState('plaine');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('map_biomes').insert({
      path_points: points,
      biome_type: biomeType,
      color: BIOME_COLORS[biomeType] ?? '#7ba05b',
      created_by: user?.id ?? null
    });

    setSaving(false);
    if (error) showToast('Impossible de créer ce biome.', 'error');
    else {
      showToast('Biome ajouté.');
      onSaved();
    }
  }

  return (
    <Modal title="Nouveau biome" onClose={onClose}>
      <div className="space-y-3">
        <select
          value={biomeType}
          onChange={(e) => setBiomeType(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
          {Object.entries(BIOME_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-paper/60">Aperçu</span>
          <span className="h-4 w-4 rounded border border-white/20" style={{ backgroundColor: BIOME_COLORS[biomeType] }} />
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
