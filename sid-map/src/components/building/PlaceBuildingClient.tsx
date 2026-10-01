'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePermission } from '@/lib/hooks/usePermission';
import CommentsBox from '@/components/map/CommentsBox';
import FloorView from './FloorView';
import Building3DView from './Building3DView';
import Navbar from '@/components/layout/Navbar';
import type { BuildingFloor, MapPlace } from '@/lib/types';
import { useTypeConfig } from '@/lib/hooks/useTypeConfig';

export default function PlaceBuildingClient({ placeId }: { placeId: string }) {
  const supabase = createClient();
  const { allowed: canEdit } = usePermission('manage_map');
  const placeTypes = useTypeConfig('place');

  const [place, setPlace] = useState<MapPlace | null>(null);
  const [floors, setFloors] = useState<BuildingFloor[]>([]);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [view3D, setView3D] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: placeData }, { data: floorsData }] = await Promise.all([
      supabase.from('map_places').select('*').eq('id', placeId).single(),
      supabase.from('building_floors').select('*').eq('place_id', placeId).order('floor_number')
    ]);
    setPlace((placeData as MapPlace) ?? null);
    const fl = (floorsData as BuildingFloor[]) ?? [];
    setFloors(fl);
    if (activeFloor === null && fl.length > 0) setActiveFloor(fl[0].floor_number);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  async function addFloor(direction: 'up' | 'down') {
    const numbers = floors.map((f) => f.floor_number);
    const nextNumber =
      floors.length === 0 ? 0 : direction === 'up' ? Math.max(...numbers) + 1 : Math.min(...numbers) - 1;
    await supabase.from('building_floors').insert({
      place_id: placeId,
      floor_number: nextNumber,
      name: nextNumber < 0 ? `Sous-sol ${Math.abs(nextNumber)}` : `Étage ${nextNumber}`
    });
    load();
  }

  async function deleteFloor(floorId: string) {
    if (!confirm('Supprimer cet étage et son plan ?')) return;
    await supabase.from('building_floors').delete().eq('id', floorId);
    load();
  }

  const current = floors.find((f) => f.floor_number === activeFloor);

  if (loading) return <p className="p-8 text-paper/60">Chargement…</p>;
  if (!place) return <p className="p-8 text-paper/60">Lieu introuvable.</p>;

  return (
    <>
      <Navbar />
      <main className="min-h-screen p-6 md:p-10">
        <Link href="/carte" className="mb-6 inline-block text-sm text-accent hover:brightness-110">
          ← Retour à la carte du monde
        </Link>

        <div className="grid gap-8 md:grid-cols-[1fr_320px]">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent">
              {placeTypes.labelFor(place.type)} — intérieur
            </p>
            <h1 className="font-display text-3xl">
              {place.icon ?? placeTypes.iconFor(place.type)} {place.name}
            </h1>

            {place.image_url && (
              <img src={place.image_url} alt={place.name} className="mt-4 h-56 w-full rounded-xl object-cover" />
            )}

            <p className="mt-4 whitespace-pre-wrap text-paper/80">
              {place.description || 'Aucune description pour le moment.'}
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
                          {f.name ||
                            (f.floor_number < 0 ? `Sous-sol ${Math.abs(f.floor_number)}` : `Étage ${f.floor_number}`)}
                        </button>
                        {canEdit && (
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
                  {!view3D && canEdit && (
                    <>
                      <button
                        onClick={() => addFloor('up')}
                        className="rounded-lg border border-dashed border-accent/50 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                      >
                        + Étage
                      </button>
                      <button
                        onClick={() => addFloor('down')}
                        className="rounded-lg border border-dashed border-white/25 px-3 py-1.5 text-sm text-paper/60 hover:bg-white/5"
                      >
                        + Sous-sol
                      </button>
                    </>
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
                <FloorView
                  floor={current}
                  canEdit={canEdit}
                  onUpdated={load}
                  onNavigateFloor={(n) => setActiveFloor(n)}
                />
              )}
            </div>
          </div>

          <div className="glass h-fit rounded-2xl p-4">
            <CommentsBox targetType="place" targetId={place.id} />
          </div>
        </div>
      </main>
    </>
  );
}
