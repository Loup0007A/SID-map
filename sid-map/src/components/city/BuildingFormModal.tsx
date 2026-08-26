'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { uploadMapImage } from '@/lib/uploadImage';
import type { BuildingType, Point } from '@/lib/types';
import { BUILDING_LABELS } from '@/lib/types';

// Le roster peut exposer le nom du membre sous différentes clés selon
// la config du premier site : on tente les plus courantes.
function displayName(p: any): string {
  return p.username ?? p.pseudo ?? p.display_name ?? p.full_name ?? p.name ?? p.id;
}

export default function BuildingFormModal({
  cityId,
  districtId,
  position,
  onClose,
  onSaved
}: {
  cityId: string;
  districtId: string | null;
  position: Point;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<BuildingType>('maison');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [roster, setRoster] = useState<any[]>([]);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('list_roster').then(({ data }) => {
      if (data) setRoster(data as any[]);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRoster = ownerQuery
    ? roster.filter((p) => displayName(p).toLowerCase().includes(ownerQuery.toLowerCase()))
    : [];

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
      description: description.trim() || null,
      image_url,
      owner_id: ownerId,
      created_by: user?.id ?? null
    });

    setSaving(false);
    onSaved();
  }

  return (
    <Modal title="Nouveau bâtiment" onClose={onClose}>
      <div className="space-y-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as BuildingType)}
          className="w-full  border border-paper/20 bg-ink px-2 py-1.5 text-sm"
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
          className="w-full  border border-paper/20 bg-ink px-2 py-1.5 text-sm outline-none focus:border-accent"
        />

        {type === 'maison' && (
          <div className="relative">
            <input
              placeholder="Propriétaire (rechercher un membre)"
              value={ownerQuery}
              onChange={(e) => {
                setOwnerQuery(e.target.value);
                setOwnerId(null);
              }}
              className="w-full  border border-paper/20 bg-ink px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            {filteredRoster.length > 0 && !ownerId && (
              <div className="absolute z-10 mt-1 max-h-32 w-full overflow-y-auto  border border-paper/20 bg-ink">
                {filteredRoster.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setOwnerId(p.id);
                      setOwnerQuery(displayName(p));
                    }}
                    className="block w-full px-2 py-1.5 text-left text-sm hover:bg-accent/20"
                  >
                    {displayName(p)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full  border border-paper/20 bg-ink px-2 py-1.5 text-sm outline-none focus:border-accent"
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
          className="w-full  bg-accent py-2 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Créer le bâtiment'}
        </button>
      </div>
    </Modal>
  );
}
