'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { uploadMapImage } from '@/lib/uploadImage';
import type { MapZone, PlaceType, Point } from '@/lib/types';
import { PLACE_LABELS } from '@/lib/types';

export default function PlaceFormModal({
  position,
  zones,
  onClose,
  onSaved
}: {
  position: Point;
  zones: MapZone[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaceType>('ville');
  const [zoneId, setZoneId] = useState<string>(zones[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);

    let image_url: string | null = null;
    if (file) image_url = await uploadMapImage(file, 'places');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    await supabase.from('map_places').insert({
      name: name.trim(),
      type,
      zone_id: zoneId || null,
      x: position.x,
      y: position.y,
      description: description.trim() || null,
      image_url,
      created_by: user?.id ?? null
    });

    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Nouveau lieu" onClose={onClose}>
      <div className="space-y-3">
        <input
          placeholder="Nom du lieu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-parchment/20 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-gold"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as PlaceType)}
          className="w-full rounded border border-parchment/20 bg-black/40 px-2 py-1.5 text-sm"
        >
          {Object.entries(PLACE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={zoneId}
          onChange={(e) => setZoneId(e.target.value)}
          className="w-full rounded border border-parchment/20 bg-black/40 px-2 py-1.5 text-sm"
        >
          <option value="">Aucune zone</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded border border-parchment/20 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-gold"
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs text-parchment/60"
        />

        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="w-full rounded bg-gold py-2 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Créer le lieu'}
        </button>
      </div>
    </Modal>
  );
}
