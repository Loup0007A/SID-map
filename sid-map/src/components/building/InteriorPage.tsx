'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { currentUser } from '@/lib/supabase/session';
import { usePermission } from '@/lib/hooks/usePermission';
import { useTypeConfig } from '@/lib/hooks/useTypeConfig';
import CommentsBox from '@/components/map/CommentsBox';
import Navbar from '@/components/layout/Navbar';
import Icon from '@/components/ui/Icon';
import { SidIcon } from '@/components/icons/SidIcon';
import OwnerPicker from '@/components/city/OwnerPicker';
import PlaceOwnerSection, { useMemberLabel } from '@/components/map/PlaceOwnerSection';
import { uploadMapImage } from '@/lib/uploadImage';
import { floorLabel } from '@/lib/rooms';
import type { BuildingFloor, CityBuilding, MapPlace } from '@/lib/types';
import FloorPlan from './FloorPlan';
import BuildingSection from './BuildingSection';
import Building3DView from './Building3DView';

type Target = { kind: 'place'; id: string } | { kind: 'building'; id: string };
type Head = {
  name: string;
  kicker: string;
  icon: string;
  description: string | null;
  image_url: string | null;
  owner_id: string | null;
  back: { href: string; label: string };
};

/**
 * Intérieur d'un bâtiment (Lot 92), pour un lieu-bâtiment de la carte du
 * monde comme pour un bâtiment de ville : cartouche du lieu et son
 * propriétaire, coupe des étages, plan de l'étage choisi, maquette 3D.
 * La gestion de la carte et le propriétaire aménagent l'intérieur.
 */
export default function InteriorPage(target: Target) {
  const supabase = useMemo(() => createClient(), []);
  const { allowed: isAdmin } = usePermission('manage_map');
  const placeTypes = useTypeConfig('place');
  const buildingTypes = useTypeConfig('building');
  const [head, setHead] = useState<Head | null>(null);
  const [floors, setFloors] = useState<BuildingFloor[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view3D, setView3D] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ description: '', image_url: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [pickOwner, setPickOwner] = useState(false);

  const load = useCallback(async () => {
    const [{ data: u }] = await Promise.all([currentUser()]);
    setMe(u.user?.id ?? null);
    if (target.kind === 'place') {
      const [{ data: p }, { data: fl }] = await Promise.all([
        supabase.from('map_places').select('*').eq('id', target.id).maybeSingle(),
        supabase.from('building_floors').select('*').eq('place_id', target.id).order('floor_number'),
      ]);
      const place = p as MapPlace | null;
      setHead(
        place
          ? {
              name: place.name,
              kicker: placeTypes.labelFor(place.type),
              icon: place.icon ?? placeTypes.iconFor(place.type),
              description: place.description,
              image_url: place.image_url,
              owner_id: place.owner_id ?? null,
              back: { href: '/carte', label: 'Carte du monde' },
            }
          : null
      );
      setFloors((fl as BuildingFloor[]) ?? []);
    } else {
      const { data } = await supabase.rpc('get_building_detail', { p_building_id: target.id });
      const b = (data?.building ?? null) as CityBuilding | null;
      let city: string | null = null;
      if (b) {
        const { data: c } = await supabase.from('map_places').select('name').eq('id', b.city_id).maybeSingle();
        city = (c as { name: string } | null)?.name ?? null;
      }
      setHead(
        b
          ? {
              name: b.name || buildingTypes.labelFor(b.type),
              kicker: `${buildingTypes.labelFor(b.type)}${city ? ` · ${city}` : ''}`,
              icon: buildingTypes.iconFor(b.type, '🏠'),
              description: b.description,
              image_url: b.image_url,
              owner_id: b.owner_id ?? null,
              back: { href: `/ville/${b.city_id}`, label: city ? `Plan de ${city}` : 'Plan de la ville' },
            }
          : null
      );
      setFloors((data?.floors ?? []) as BuildingFloor[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, target.kind, target.id, placeTypes.loading, buildingTypes.loading]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (floors.length === 0) return setActive(null);
    if (active === null || !floors.some((f) => f.floor_number === active)) {
      setActive((floors.find((f) => f.floor_number === 0) ?? floors[0]).floor_number);
    }
  }, [floors, active]);

  const isOwner = !!me && !!head?.owner_id && head.owner_id === me;
  const canEdit = isAdmin || isOwner;
  const ownerLabel = useMemberLabel(head?.owner_id);
  const current = floors.find((f) => f.floor_number === active) ?? null;
  const ownerKey = target.kind === 'place' ? { place_id: target.id } : { building_id: target.id };

  async function addFloor(dir: 'up' | 'down') {
    const nums = floors.map((f) => f.floor_number);
    const n = floors.length === 0 ? (dir === 'up' ? 0 : -1) : dir === 'up' ? Math.max(...nums, -1) + 1 : Math.min(...nums, 0) - 1;
    const { error } = await supabase.from('building_floors').insert({ ...ownerKey, floor_number: n, name: floorLabel(n) });
    if (error) return setMsg(`Étage non ajouté : ${error.message}`);
    setActive(n);
    await load();
  }
  async function renameFloor(name: string) {
    if (!current || !name.trim() || name.trim() === current.name) return;
    const { error } = await supabase.from('building_floors').update({ name: name.trim().slice(0, 40) }).eq('id', current.id);
    if (error) setMsg(error.message);
    await load();
  }
  async function deleteFloor() {
    if (!current) return;
    if (!confirm(`Supprimer « ${floorLabel(current.floor_number, current.name)} » et son plan ?`)) return;
    const { error } = await supabase.from('building_floors').delete().eq('id', current.id);
    if (error) return setMsg(error.message);
    setActive(null);
    await load();
  }
  async function saveHead() {
    setMsg(null);
    const desc = draft.description.trim();
    const img = draft.image_url.trim();
    const { error } =
      target.kind === 'place'
        ? await supabase.rpc('map_place_owner_edit', { p_place: target.id, p_description: desc, p_image_url: img })
        : await supabase.from('city_buildings').update({ description: desc || null, image_url: img || null }).eq('id', target.id);
    if (error) return setMsg(error.message);
    setEditing(false);
    await load();
  }
  async function uploadImg(file: File) {
    const url = await uploadMapImage(file, 'interieurs');
    if (!url) return setMsg("Envoi de l'image refusé. Colle plutôt l'adresse d'une image.");
    setDraft((d) => ({ ...d, image_url: url }));
  }
  async function setBuildingOwner(id: string | null) {
    setPickOwner(false);
    const { error } = await supabase.from('city_buildings').update({ owner_id: id }).eq('id', target.id);
    if (error) return setMsg(error.message);
    await load();
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 md:px-8">
        {loading ? (
          <p className="py-10 text-center opacity-75">Chargement de l&apos;intérieur…</p>
        ) : !head ? (
          <p className="py-10 text-center opacity-75">Lieu introuvable.</p>
        ) : (
          <>
            <Link href={head.back.href} className="back-link">
              ← {head.back.label}
            </Link>

            <header className="vellum interior-head mt-4 rounded-2xl p-4 md:p-5">
              <span className="interior-seal" aria-hidden>
                <Icon value={head.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="section-label">{head.kicker} · intérieur</p>
                <h1 className="interior-title">{head.name}</h1>
                {!editing && (
                  <p className="mt-2 max-w-[65ch] whitespace-pre-wrap font-serif text-[1.05rem] leading-relaxed">
                    {head.description || (canEdit ? 'Pas encore de description. Ajoute-en une.' : 'Pas encore de description.')}
                  </p>
                )}
                {editing && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      rows={4}
                      maxLength={4000}
                      className="glass-input w-full rounded-lg px-3 py-2 text-sm"
                      aria-label="Description"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={draft.image_url}
                        onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                        placeholder="Adresse d'une image (facultatif)"
                        className="glass-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
                        aria-label="Image"
                      />
                      <label className="btn-ghost cursor-pointer rounded-lg px-3 py-1.5 text-sm">
                        Envoyer une image
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadImg(e.target.files[0])} />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveHead} className="btn-accent rounded-lg px-3 py-1.5 text-sm">
                        Enregistrer
                      </button>
                      <button onClick={() => setEditing(false)} className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canEdit && !editing && (
                    <button
                      onClick={() => {
                        setDraft({ description: head.description ?? '', image_url: head.image_url ?? '' });
                        setEditing(true);
                      }}
                      className="btn-ghost rounded-lg px-3 py-1.5 text-sm"
                    >
                      <SidIcon name="pen" /> Modifier la fiche
                    </button>
                  )}
                  {isOwner && <span className="tag-own text-xs">Tu es propriétaire</span>}
                </div>
              </div>
              {head.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={head.image_url} alt="" className="interior-photo" />
              )}
              <div className="basis-full">
                {target.kind === 'place' ? (
                  <PlaceOwnerSection placeId={target.id} ownerId={head.owner_id} canEdit={isAdmin} myUserId={me} onChanged={() => void load()} />
                ) : (
                  (head.owner_id || isAdmin) && (
                    <div className="owner-card">
                      <span className="owner-seal" aria-hidden>
                        <SidIcon name="home" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="section-label">Propriétaire</p>
                        <p className="truncate font-semibold">{head.owner_id ? (isOwner ? 'Toi' : ownerLabel ?? 'Membre') : 'Personne'}</p>
                      </div>
                      {isAdmin && (
                        <button onClick={() => setPickOwner(true)} className="btn-ghost shrink-0 rounded-lg px-2.5 py-1 text-xs">
                          {head.owner_id ? 'Changer' : 'Donner à…'}
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            </header>

            {msg && (
              <p role="status" className="note-strip mt-3 rounded-lg px-3 py-2 text-sm">
                {msg}
              </p>
            )}

            <section className="mt-6 grid gap-5 md:grid-cols-[250px_minmax(0,1fr)]">
              <BuildingSection floors={floors} active={view3D ? null : active} onPick={(n) => { setView3D(false); setActive(n); }} canEdit={canEdit} onAdd={addFloor} />

              <div className="vellum min-w-0 rounded-2xl p-3 md:p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {view3D ? (
                    <h2 className="interior-floor-title">Maquette, tous les étages</h2>
                  ) : current ? (
                    canEdit ? (
                      <input
                        key={current.id}
                        defaultValue={floorLabel(current.floor_number, current.name)}
                        onBlur={(e) => renameFloor(e.target.value)}
                        aria-label="Nom de l'étage"
                        className="interior-floor-title floor-name-input"
                      />
                    ) : (
                      <h2 className="interior-floor-title">{floorLabel(current.floor_number, current.name)}</h2>
                    )
                  ) : (
                    <h2 className="interior-floor-title">Aucun étage</h2>
                  )}
                  <div className="ml-auto flex flex-wrap gap-2">
                    {canEdit && current && !view3D && (
                      <button onClick={deleteFloor} className="btn-ghost rounded-lg px-2.5 py-1 text-xs">
                        Supprimer l&apos;étage
                      </button>
                    )}
                    <button onClick={() => setView3D((v) => !v)} disabled={floors.length === 0} className="btn-accent rounded-lg px-3 py-1.5 text-xs disabled:opacity-40">
                      {view3D ? 'Revenir au plan' : 'Maquette 3D'}
                    </button>
                  </div>
                </div>
                {floors.length === 0 ? (
                  <p className="py-12 text-center text-sm opacity-75">
                    {canEdit ? 'Commence par ajouter un étage dans la coupe.' : 'Personne n’a encore dessiné l’intérieur.'}
                  </p>
                ) : view3D ? (
                  <Building3DView floors={floors} />
                ) : current ? (
                  <FloorPlan floor={current} floors={floors} canEdit={canEdit} onUpdated={() => void load()} onNavigateFloor={setActive} />
                ) : null}
              </div>
            </section>

            <section className="glass-strong mt-6 rounded-2xl p-4">
              <CommentsBox targetType={target.kind} targetId={target.id} />
            </section>
          </>
        )}
      </main>
      {pickOwner && target.kind === 'building' && (
        <OwnerPicker currentOwnerId={head?.owner_id} onClose={() => setPickOwner(false)} onSelect={(id) => setBuildingOwner(id)} />
      )}
    </>
  );
}
