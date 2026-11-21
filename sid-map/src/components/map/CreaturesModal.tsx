'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { SidIcon } from '@/components/icons/SidIcon';
import { BIOME_LABELS, type MapBiome, type MapPlace } from '@/lib/types';
import { inPoly } from '@/lib/weather';
import type { Incursion } from '@/lib/hooks/useMapEvents';

type Creature = {
  entry_id: string;
  number: number;
  title: string;
  image_url: string | null;
  rarity: number | null;
  discovered: boolean;
  custom: boolean;
  enabled: boolean;
  weight: number;
  allow_places: string[];
  allow_biomes: string[];
  deny_places: string[];
  deny_biomes: string[];
  places_ok: number;
  sightings: number;
};
type AdminData = { deny_places: string[]; deny_biomes: string[]; creatures: Creature[] };
type Spot = { places: string[]; biomes: string[] };

const HOURS = [1, 2, 3, 6, 12, 24];

/** Choix de lieux et de biomes : des pastilles, et un menu pour en ajouter. */
function SpotPicker({
  label,
  value,
  onChange,
  places,
  biomeLabels,
  tone,
}: {
  label: string;
  value: Spot;
  onChange: (v: Spot) => void;
  places: MapPlace[];
  biomeLabels: Map<string, string>;
  tone: 'allow' | 'deny';
}) {
  const name = (id: string) => places.find((p) => p.id === id)?.name ?? 'Lieu supprimé';
  return (
    <div>
      <p className="mb-1 text-xs font-semibold">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.places.map((id) => (
          <span key={id} className={`chip ${tone === 'deny' ? 'chip-off' : 'chip-on'}`}>
            {name(id)}
            <button aria-label={`Retirer ${name(id)}`} onClick={() => onChange({ ...value, places: value.places.filter((x) => x !== id) })}>
              ✕
            </button>
          </span>
        ))}
        {value.biomes.map((id) => (
          <span key={id} className={`chip ${tone === 'deny' ? 'chip-off' : 'chip-on'}`}>
            {biomeLabels.get(id) ?? 'Biome supprimé'}
            <button aria-label="Retirer ce biome" onClick={() => onChange({ ...value, biomes: value.biomes.filter((x) => x !== id) })}>
              ✕
            </button>
          </span>
        ))}
        <select
          value=""
          aria-label={`${label} : ajouter`}
          onChange={(e) => {
            const [k, id] = e.target.value.split(':');
            if (!id) return;
            if (k === 'p' && !value.places.includes(id)) onChange({ ...value, places: [...value.places, id] });
            if (k === 'b' && !value.biomes.includes(id)) onChange({ ...value, biomes: [...value.biomes, id] });
          }}
          className="glass-input rounded-lg px-2 py-1 text-xs"
        >
          <option value="">+ Ajouter…</option>
          <optgroup label="Lieux">
            {places
              .filter((p) => !value.places.includes(p.id))
              .map((p) => (
                <option key={p.id} value={`p:${p.id}`}>
                  {p.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="Biomes (tous les lieux dedans)">
            {[...biomeLabels.entries()]
              .filter(([id]) => !value.biomes.includes(id))
              .map(([id, l]) => (
                <option key={id} value={`b:${id}`}>
                  {l}
                </option>
              ))}
          </optgroup>
        </select>
      </div>
    </div>
  );
}

/**
 * Gestion des créatures (migration 0120) : lesquelles rôdent, à quelle
 * fréquence, où elles peuvent apparaître ou non ; en faire apparaître une
 * tout de suite, ou renvoyer celle en cours.
 */
export default function CreaturesModal({
  places,
  biomes,
  incursion,
  onClose,
  onChanged,
}: {
  places: MapPlace[];
  biomes: MapBiome[];
  incursion: Incursion | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<AdminData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'on' | 'off'>('all');
  const [spawn, setSpawn] = useState<{ place: string; hours: number }>({ place: '', hours: 3 });
  const [busy, setBusy] = useState(false);

  const published = useMemo(() => places.filter((p) => p.is_published !== false).sort((a, b) => a.name.localeCompare(b.name, 'fr')), [places]);
  // Biomes nommés par leur type et les lieux qu'ils contiennent.
  const biomeLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of biomes) {
      if (b.is_published === false || b.path_points.length < 3) continue;
      const inside = published.filter((p) => inPoly(p.x, p.y, b.path_points)).map((p) => p.name);
      const t = BIOME_LABELS[b.biome_type] ?? b.biome_type;
      m.set(b.id, inside.length ? `${t} (${inside.slice(0, 3).join(', ')}${inside.length > 3 ? '…' : ''})` : `${t} (sans lieu)`);
    }
    return m;
  }, [biomes, published]);

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc('map_creatures_admin');
    if (error) return setErr(error.message.includes('function') ? 'Migration 0120 à lancer dans Supabase.' : error.message);
    setData(d as AdminData);
  }, [supabase]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(c: Creature, patch: Partial<Creature>) {
    const n = { ...c, ...patch };
    setMsg(null);
    const { error } = await supabase.rpc('map_creature_set', {
      p_entry: c.entry_id,
      p_enabled: n.enabled,
      p_weight: n.weight,
      p_allow_places: n.allow_places,
      p_allow_biomes: n.allow_biomes,
      p_deny_places: n.deny_places,
      p_deny_biomes: n.deny_biomes,
    });
    if (error) return setMsg(error.message);
    await load();
    onChanged();
  }

  async function reset(c: Creature) {
    const { error } = await supabase.rpc('map_creature_set', {
      p_entry: c.entry_id, p_enabled: null, p_weight: null,
      p_allow_places: null, p_allow_biomes: null, p_deny_places: null, p_deny_biomes: null,
    });
    setMsg(error ? error.message : `${c.title} : réglage par défaut.`);
    await load();
  }

  async function saveDeny(v: Spot) {
    const { error } = await supabase.rpc('map_creatures_deny_set', { p_places: v.places, p_biomes: v.biomes });
    setMsg(error ? error.message : 'Lieux interdits enregistrés.');
    await load();
    onChanged();
  }

  async function doSpawn(c: Creature) {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc('map_creature_spawn', { p_entry: c.entry_id, p_place: spawn.place || null, p_hours: spawn.hours });
    setBusy(false);
    setMsg(error ? error.message : `${c.title} apparaît sur la carte pour ${spawn.hours} h.`);
    onChanged();
  }

  async function dismiss() {
    setBusy(true);
    const { error } = await supabase.rpc('map_creature_dismiss');
    setBusy(false);
    setMsg(error ? error.message : 'La créature est repartie. Prochain tirage à la prochaine période de 6 heures.');
    onChanged();
  }

  const list = (data?.creatures ?? []).filter((c) => (filter === 'on' ? c.enabled : filter === 'off' ? !c.enabled : true));
  const where = (c: Creature) => {
    const only = c.allow_places.length + c.allow_biomes.length > 0;
    const never = c.deny_places.length + c.deny_biomes.length > 0;
    const base = only ? 'Seulement à certains endroits' : 'Partout';
    return `${base}${never ? ', sauf exceptions' : ''} · ${c.places_ok} lieu${c.places_ok > 1 ? 'x' : ''} possible${c.places_ok > 1 ? 's' : ''}`;
  };

  return (
    <Modal title="Créatures de la carte" onClose={onClose} maxWidth="max-w-2xl" windowId="creatures">
      <div className="space-y-4 text-sm">
        {err && <p className="text-accent">{err}</p>}

        <div className="sheet flex flex-wrap items-center gap-3 rounded-xl p-3">
          <span className="creature-portrait" aria-hidden>
            {incursion?.entry.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={incursion.entry.image_url} alt="" />
            ) : (
              <span>{incursion ? '?' : '—'}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="section-label">En ce moment</p>
            <p className="font-semibold">
              {incursion ? `${incursion.entry.title ?? 'Créature'} rôde${incursion.started ? '' : ' (bientôt)'}` : 'Aucune créature sur la carte'}
            </p>
            {incursion && (
              <p className="text-xs opacity-75">
                Repart à {new Date(incursion.ends_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                {incursion.manual ? ' · placée à la main' : ''}
              </p>
            )}
          </div>
          {incursion && (
            <button onClick={dismiss} disabled={busy} className="btn-danger rounded-lg px-3 py-1.5 text-xs disabled:opacity-50">
              Renvoyer
            </button>
          )}
        </div>

        {data && (
          <div className="sheet rounded-xl p-3">
            <SpotPicker
              label="Interdits à toutes les créatures"
              value={{ places: data.deny_places, biomes: data.deny_biomes }}
              onChange={saveDeny}
              places={published}
              biomeLabels={biomeLabels}
              tone="deny"
            />
            <p className="mt-1 text-xs opacity-70">Une ville refuge, un sanctuaire… Aucune créature n&apos;y passe, même apparue à la main.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs opacity-75">
            Par défaut, seules les créatures découvertes dans le Wiki rôdent. Ajoute une créature inconnue : elle rôdera sous le nom « Créature inconnue », et le premier à la signaler la révélera.
          </p>
          <div className="seg-group" role="radiogroup" aria-label="Filtrer">
            {(
              [
                ['all', 'Toutes'],
                ['on', 'Rôdent'],
                ['off', 'Retirées'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={`seg ${filter === k ? 'is-on' : ''}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <p role="status" className="note-strip rounded-lg px-3 py-2 text-xs">
            {msg}
          </p>
        )}

        {!data && !err && <p className="text-xs opacity-70">Chargement…</p>}
        {data && list.length === 0 && <p className="text-xs opacity-70">Aucune créature ici. Les créatures sont les fiches « Mobs » du Wiki.</p>}

        <ul className="space-y-2">
          {list.map((c) => {
            const open = openId === c.entry_id;
            return (
              <li key={c.entry_id} className={`creature-row ${c.enabled ? '' : 'is-off'}`}>
                <div className="flex items-center gap-3">
                  <span className="creature-portrait" aria-hidden>
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" />
                    ) : (
                      <span>?</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      <span className="mr-1 opacity-60">N° {String(c.number).padStart(3, '0')}</span>
                      {c.title}
                    </p>
                    <p className="truncate text-xs opacity-75">
                      {!c.discovered && <span className="tag-own mr-1">inconnue</span>}
                      {where(c)} · {c.sightings} signalement{c.sightings > 1 ? 's' : ''}
                    </p>
                  </div>
                  <label className="switch shrink-0" title={c.enabled ? 'Retirer de la carte' : 'Ajouter à la carte'}>
                    <input type="checkbox" checked={c.enabled} onChange={(e) => save(c, { enabled: e.target.checked })} />
                    <span aria-hidden />
                    <span className="sr-only">Rôde sur la carte</span>
                  </label>
                  <button onClick={() => setOpenId(open ? null : c.entry_id)} aria-expanded={open} className="btn-ghost shrink-0 rounded-lg px-2 py-1 text-xs">
                    Régler
                  </button>
                </div>

                {open && (
                  <div className="mt-3 space-y-3 border-t-2 border-dashed border-current/20 pt-3">
                    <label className="flex items-center gap-2 text-xs">
                      Fréquence
                      <select value={c.weight} onChange={(e) => save(c, { weight: Number(e.target.value) })} className="glass-input rounded-lg px-2 py-1">
                        {[1, 2, 3, 4, 5, 8, 10, 15, 20].map((w) => (
                          <option key={w} value={w}>
                            {w === 1 ? 'Normale (×1)' : `×${w}`}
                          </option>
                        ))}
                      </select>
                      <span className="opacity-70">Plus elle est haute, plus elle sort souvent au tirage.</span>
                    </label>
                    <SpotPicker
                      label="Seulement ici (vide : partout)"
                      value={{ places: c.allow_places, biomes: c.allow_biomes }}
                      onChange={(v) => save(c, { allow_places: v.places, allow_biomes: v.biomes })}
                      places={published}
                      biomeLabels={biomeLabels}
                      tone="allow"
                    />
                    <SpotPicker
                      label="Jamais ici"
                      value={{ places: c.deny_places, biomes: c.deny_biomes }}
                      onChange={(v) => save(c, { deny_places: v.places, deny_biomes: v.biomes })}
                      places={published}
                      biomeLabels={biomeLabels}
                      tone="deny"
                    />
                    <div className="flex flex-wrap items-end gap-2 rounded-lg border-2 border-dashed border-current/20 p-2">
                      <label className="text-xs">
                        Départ
                        <select value={spawn.place} onChange={(e) => setSpawn({ ...spawn, place: e.target.value })} className="glass-input mt-1 block rounded-lg px-2 py-1">
                          <option value="">Lieu permis au hasard</option>
                          {published.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs">
                        Durée
                        <select value={spawn.hours} onChange={(e) => setSpawn({ ...spawn, hours: Number(e.target.value) })} className="glass-input mt-1 block rounded-lg px-2 py-1">
                          {HOURS.map((h) => (
                            <option key={h} value={h}>
                              {h} h
                            </option>
                          ))}
                        </select>
                      </label>
                      <button onClick={() => doSpawn(c)} disabled={busy || c.places_ok === 0} className="btn-accent rounded-lg px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-50">
                        <SidIcon name="claws" /> Faire apparaître
                      </button>
                      {c.custom && (
                        <button onClick={() => reset(c)} className="btn-ghost ml-auto rounded-lg px-2.5 py-1.5 text-xs">
                          Réglage par défaut
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
