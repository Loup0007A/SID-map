'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import type { Point } from '@/lib/types';

export default function RouteFormModal({
  pathPoints,
  fromPlaceId,
  toPlaceId,
  onClose,
  onSaved
}: {
  pathPoints: Point[];
  fromPlaceId: string;
  toPlaceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState<string>('');
  const [color, setColor] = useState('#e7c34a');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('map_routes').insert({
      name: name.trim() || null,
      from_place_id: fromPlaceId,
      to_place_id: toPlaceId,
      path_points: pathPoints,
      color,
      travel_minutes: minutes ? Number(minutes) : null,
      created_by: user?.id ?? null
    });

    setSaving(false);
    if (error) showToast('Impossible de créer la route.', 'error');
    else {
      showToast('Route créée.');
      onSaved();
    }
  }

  return (
    <Modal title="Nouvelle route" onClose={onClose}>
      <div className="space-y-3">
        <input
          placeholder="Nom (ex: Route du Nord)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
        />
        <input
          type="number"
          min={0}
          placeholder="Temps de trajet RP (minutes, optionnel)"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-paper/60">Couleur du tracé</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Créer la route'}
        </button>
      </div>
    </Modal>
  );
}
