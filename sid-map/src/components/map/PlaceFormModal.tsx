'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { uploadMapImage } from '@/lib/uploadImage';
import type { MapZone, MarkerShape, PlaceType, Point } from '@/lib/types';
import { PLACE_LABELS } from '@/lib/types';

export default function PlaceFormModal({
  position,
  zones,
  initialRadius,
  initialShape,
  onClose,
  onSaved
}: {
  position: Point;
  zones: MapZone[];
  initialRadius?: number;
  initialShape?: MarkerShape;
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
  const [radius, setRadius] = useState(initialRadius ?? 3);
  const [width, setWidth] = useState((initialRadius ?? 3) * 2);
  const [height, setHeight] = useState((initialRadius ?? 3) * 2);
  const shape: MarkerShape = initialShape ?? 'circle';

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
      shape,
      radius,
      width: shape === 'rect' ? width : null,
      height: shape === 'rect' ? height : null,
      created_by: user?.id ?? null
    });

    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={`Nouveau lieu (${shape === 'circle' ? 'rond' : 'rectangle'})`} onClose={onClose}>
      <div className="space-y-3">
        <input
          placeholder="Nom du lieu"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as PlaceType)}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm"
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
          className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Aucune zone</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>

        {shape === 'circle' ? (
          <div className="space-y-1">
            <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50">
              <span>Taille (rayon) — ajuste l'icône</span>
              <span className="text-accent">{radius.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={1}
              max={12}
              step={0.5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-[#b3261e]"
            />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50">
                <span>Largeur</span>
                <span className="text-accent">{width.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={2}
                max={20}
                step={0.5}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full accent-[#b3261e]"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50">
                <span>Hauteur</span>
                <span className="text-accent">{height.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={2}
                max={20}
                step={0.5}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full accent-[#b3261e]"
              />
            </div>
          </>
        )}

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-xs text-paper/60"
        />

        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Créer le lieu'}
        </button>
      </div>
    </Modal>
  );
}
