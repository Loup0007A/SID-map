'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import CommentsBox from '@/components/map/CommentsBox';
import FloorView from './FloorView';
import type { BuildingFloor, CityBuilding } from '@/lib/types';
import { BUILDING_LABELS } from '@/lib/types';

export default function BuildingClient({ buildingId }: { buildingId: string }) {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');

  const [building, setBuilding] = useState<CityBuilding | null>(null);
  const [floors, setFloors] = useState<BuildingFloor[]>([]);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('get_building_detail', { p_building_id: buildingId });
    if (data) {
      setBuilding(data.building ?? null);
      const fl = (data.floors ?? []) as BuildingFloor[];
      setFloors(fl);
      if (activeFloor === null && fl.length > 0) setActiveFloor(fl[0].floor_number);

      const {
        data: { user }
      } = await supabase.auth.getUser();
      setIsOwner(!!user && data.building?.owner_id === user.id);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  async function addFloor() {
    const nextNumber =
      floors.length === 0 ? 0 : Math.max(...floors.map((f) => f.floor_number)) + 1;
    await supabase.from('building_floors').insert({
      building_id: buildingId,
      floor_number: nextNumber,
      name: `Étage ${nextNumber}`
    });
    load();
  }

  const canEditPlan = canEdit || isOwner;
  const current = floors.find((f) => f.floor_number === activeFloor);

  if (loading) return <p className="p-8 text-parchment/60">Chargement…</p>;
  if (!building) return <p className="p-8 text-parchment/60">Bâtiment introuvable.</p>;

  return (
    <main className="min-h-screen bg-ink p-6 md:p-10">
      <Link
        href={`/ville/${building.city_id}`}
        className="mb-6 inline-block text-sm text-gold hover:brightness-110"
      >
        ← Retour au plan de la ville
      </Link>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <p className="text-xs uppercase tracking-wide text-gold">{BUILDING_LABELS[building.type]}</p>
          <h1 className="font-display text-3xl">{building.name || BUILDING_LABELS[building.type]}</h1>

          {building.image_url && (
            <img
              src={building.image_url}
              alt={building.name ?? ''}
              className="mt-4 h-56 w-full rounded object-cover"
            />
          )}

          <p className="mt-4 whitespace-pre-wrap text-parchment/80">
            {building.description || 'Aucune description pour le moment.'}
          </p>

          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {floors.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFloor(f.floor_number)}
                  className={`rounded px-3 py-1.5 text-sm ${
                    activeFloor === f.floor_number
                      ? 'bg-gold text-ink'
                      : 'border border-parchment/25 text-parchment/70 hover:border-gold'
                  }`}
                >
                  {f.name || `Étage ${f.floor_number}`}
                </button>
              ))}
              {canEditPlan && (
                <button
                  onClick={addFloor}
                  className="rounded border border-dashed border-gold/50 px-3 py-1.5 text-sm text-gold hover:bg-gold/10"
                >
                  + Ajouter un étage
                </button>
              )}
            </div>

            {current ? (
              <FloorView floor={current} canEdit={canEditPlan} onUpdated={load} />
            ) : (
              <p className="text-sm text-parchment/50">Aucun étage renseigné pour le moment.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gold/20 bg-black/20 p-4">
          <CommentsBox targetType="building" targetId={building.id} />
        </div>
      </div>
    </main>
  );
}
