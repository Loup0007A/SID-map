'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { uploadMapImage } from '@/lib/uploadImage';
import type { Point, ZoneType } from '@/lib/types';
import { ZONE_LABELS } from '@/lib/types';

export default function ZoneFormModal({
  points,
  onClose,
  onSaved
}: {
  points: Point[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<ZoneType>('continent');
  const [color, setColor] = useState('#60a5fa');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || points.length < 3) return;
    setSaving(true);

    let image_url: string | null = null;
    if (file) image_url = await uploadMapImage(file, 'zones');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    await supabase.from('map_zones').insert({
      name: name.trim(),
      type,
      color,
      path_points: points,
      description: description.trim() || null,
      image_url,
      created_by: user?.id ?? null
    });

    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Nouvelle zone" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-paper/50">{points.length} point(s) tracé(s)</p>

        <input
          placeholder="Nom (ex: Continent d'Aravel)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none transition"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as ZoneType)}
          style={{ colorScheme: 'dark' }}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
        >
          {Object.entries(ZONE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-xs text-paper/60">Couleur</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none transition"
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs text-paper/60"
        />

        <button
          onClick={save}
          disabled={saving || !name.trim() || points.length < 3}
          className="w-full btn-accent rounded-lg py-2.5 text-sm font-semibold text-paper transition disabled:opacity-40"
        >
          {saving ? 'Enregistrement…' : 'Créer la zone'}
        </button>
      </div>
    </Modal>
  );
}
