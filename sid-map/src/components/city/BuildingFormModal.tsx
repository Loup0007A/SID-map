'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { uploadMapImage } from '@/lib/uploadImage';
import type { BuildingType, MarkerShape, Point } from '@/lib/types';
import { BUILDING_LABELS } from '@/lib/types';
import OwnerPicker from './OwnerPicker';

export default function BuildingFormModal({
  cityId,
  districtId,
  position,
  initialSize,
  initialShape,
  onClose,
  onSaved
}: {
  cityId: string;
  districtId: string | null;
  position: Point;
  initialSize?: { width: number; height: number };
  initialShape?: MarkerShape;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<BuildingType>('maison');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [width, setWidth] = useState(initialSize?.width ?? 4);
  const [height, setHeight] = useState(initialSize?.height ?? initialSize?.width ?? 4);
  const [shape] = useState<MarkerShape>(initialShape ?? 'circle');

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);
  const [showOwnerPicker, setShowOwnerPicker] = useState(false);

  async function save() {
    setSaving(true);

    let image_url: string | null = null;
    if (file) image_url = await uploadMapImage(file, 'buildings');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    await supabase.from('city_buildings').insert({
      city_id: cityId,
      district_id: districtId,
      type,
      name: name.trim() || null,
      x: position.x,
      y: position.y,
      width,
      height: shape === 'circle' ? width : height,
      shape,
      description: description.trim() || null,
      image_url,
      owner_id: ownerId,
      created_by: user?.id ?? null
    });

    setSaving(false);
    onSaved();
  }

  return (
    <>
      <Modal title={`Nouveau bâtiment (${shape === 'circle' ? 'rond' : 'rectangle'})`} onClose={onClose}>
        <div className="space-y-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BuildingType)}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm"
          >
            {Object.entries(BUILDING_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          <input
            placeholder="Nom (optionnel, ex: Cathédrale Sainte-Aravel)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
          />

          <div className="space-y-1">
            <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50">
              <span>{shape === 'circle' ? 'Taille (rayon)' : 'Largeur'}</span>
              <span className="text-accent">{width.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={1.5}
              max={16}
              step={0.5}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full accent-[#b3261e]"
            />
          </div>

          {shape === 'rect' && (
            <div className="space-y-1">
              <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50">
                <span>Hauteur</span>
                <span className="text-accent">{height.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={1.5}
                max={16}
                step={0.5}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full accent-[#b3261e]"
              />
            </div>
          )}

          {type === 'maison' && (
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-paper/50">
                Propriétaire
              </label>
              <button
                type="button"
                onClick={() => setShowOwnerPicker(true)}
                className="w-full glass-input rounded-lg px-3 py-2 text-left text-sm text-paper/80 hover:border-accent"
              >
                {ownerLabel ? `👤 ${ownerLabel}` : '🔍 Rechercher un membre…'}
              </button>
            </div>
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
            disabled={saving}
            className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Créer le bâtiment'}
          </button>
        </div>
      </Modal>

      {showOwnerPicker && (
        <OwnerPicker
          currentOwnerId={ownerId}
          onClose={() => setShowOwnerPicker(false)}
          onSelect={(id, label) => {
            setOwnerId(id);
            setOwnerLabel(label);
            setShowOwnerPicker(false);
          }}
        />
      )}
    </>
  );
}
