'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import type { Point } from '@/lib/types';

export default function DistrictFormModal({
  cityId,
  points,
  onClose,
  onSaved
}: {
  cityId: string;
  points: Point[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#a3a3a3');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || points.length < 3) return;
    setSaving(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    await supabase.from('city_districts').insert({
      city_id: cityId,
      name: name.trim(),
      color,
      path_points: points,
      description: description.trim() || null,
      created_by: user?.id ?? null
    });

    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Nouveau quartier" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-parchment/50">{points.length} point(s) tracé(s)</p>
        <input
          placeholder="Nom du quartier"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-parchment/20 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-gold"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-parchment/60">Couleur</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded border border-parchment/20 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-gold"
        />
        <button
          onClick={save}
          disabled={saving || !name.trim() || points.length < 3}
          className="w-full rounded bg-gold py-2 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Créer le quartier'}
        </button>
      </div>
    </Modal>
  );
}
