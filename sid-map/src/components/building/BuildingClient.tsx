'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import CommentsBox from '@/components/map/CommentsBox';
import FloorView from './FloorView';
import Building3DView from './Building3DView';
import Navbar from '@/components/layout/Navbar';
import type { BuildingFloor, CityBuilding } from '@/lib/types';
import { useTypeConfig } from '@/lib/hooks/useTypeConfig';

export default function BuildingClient({ buildingId }: { buildingId: string }) {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');
  const buildingTypes = useTypeConfig('building');

  const [building, setBuilding] = useState<CityBuilding | null>(null);
  const [floors, setFloors] = useState<BuildingFloor[]>([]);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [view3D, setView3D] = useState(false);

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
    const nextNumber = floors.length === 0 ? 0 : Math.max(...floors.map((f) => f.floor_number)) + 1;
    await supabase.from('building_floors').insert({
      building_id: buildingId,
      floor_number: nextNumber,
      name: `Étage ${nextNumber}`
    });
    load();
  }

  async function deleteFloor(floorId: string) {
    if (!confirm('Supprimer cet étage et son plan ?')) return;
    await supabase.from('building_floors').delete().eq('id', floorId);
    load();
  }

  const canEditPlan = canEdit || isOwner;
  const current = floors.find((f) => f.floor_number === activeFloor);

  if (loading) return <p className="p-8 text-paper/60">Chargement…</p>;
  if (!building) return <p className="p-8 text-paper/60">Bâtiment introuvable.</p>;

  return (
    <>
      <Navbar />
      <main className="min-h-screen p-6 md:p-10">
      <Link href={`/ville/${building.city_id}`} className="mb-6 inline-block text-sm text-accent hover:brightness-110">
        ← Retour au plan de la ville
      </Link>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <p className="text-xs uppercase tracking-wide text-accent">{buildingTypes.labelFor(building.type)}</p>
          <h1 className="font-display text-3xl">{building.name || buildingTypes.labelFor(building.type)}</h1>

          {building.image_url && (
            <img src={building.image_url} alt={building.name ?? ''} className="mt-4 h-56 w-full rounded-xl object-cover" />
          )}

          <p className="mt-4 whitespace-pre-wrap text-paper/80">
            {building.description || 'Aucune description pour le moment.'}
          </p>

          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {!view3D &&
                  floors.map((f) => (
                    <div key={f.id} className="group relative">
                      <button
                        onClick={() => setActiveFloor(f.floor_number)}
                        className={`rounded-lg px-3 py-1.5 text-sm transition ${
                          activeFloor === f.floor_number
                            ? 'btn-accent text-paper'
                            : 'border border-white/15 bg-white/5 text-paper/70 hover:border-accent'
                        }`}
                      >
                        {f.name || `Étage ${f.floor_number}`}
                      </button>
                      {canEditPlan && (
                        <button
                          onClick={() => deleteFloor(f.id)}
                          title="Supprimer l'étage"
                          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-paper opacity-70 hover:opacity-100"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                {!view3D && canEditPlan && (
                  <button
                    onClick={addFloor}
                    className="rounded-lg border border-dashed border-accent/50 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                  >
                    + Ajouter un étage
                  </button>
                )}
              </div>

              <button
                onClick={() => setView3D((v) => !v)}
                disabled={floors.length === 0}
                className="btn-accent rounded-lg px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-40"
              >
                {view3D ? 'Vue à plat (édition)' : 'Vue 3D — tous les étages'}
              </button>
            </div>

            {floors.length === 0 && <p className="text-sm text-paper/50">Aucun étage renseigné pour le moment.</p>}

            {floors.length > 0 && view3D && <Building3DView floors={floors} />}

            {floors.length > 0 && !view3D && current && (
              <FloorView floor={current} canEdit={canEditPlan} onUpdated={load} />
            )}
          </div>
        </div>

        <div className="glass h-fit rounded-2xl p-4">
          <CommentsBox targetType="building" targetId={building.id} />
        </div>
      </div>
      </main>
    </>
  );
}
