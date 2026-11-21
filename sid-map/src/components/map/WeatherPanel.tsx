'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SidIcon } from '@/components/icons/SidIcon';
import { BIOME_LABELS, type MapBiome, type MapPlace } from '@/lib/types';
import { WEATHER_GLYPH, fmtFactor, type WeatherNow } from '@/lib/weather';

type Settings = { weather_enabled?: boolean; incursions_enabled?: boolean; incursion_chance?: number; incursion_sight_reputation?: number };

/** Bouton « Météo » : temps par biome, prévision, et réglages pour la gestion de la carte. */
export default function WeatherPanel({
  weather,
  biomes,
  canEdit,
  settings,
  focusBiome,
  places = [],
  onOpenCreatures,
  shown,
  onShow,
  onChanged,
}: {
  places?: MapPlace[];
  onOpenCreatures?: () => void;
  shown: boolean;
  onShow: (v: boolean) => void;
  weather: WeatherNow;
  biomes: MapBiome[];
  canEdit: boolean;
  settings: Settings;
  focusBiome: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [chance, setChance] = useState(String(Math.round((settings.incursion_chance ?? 0.6) * 100)));
  const [rep, setRep] = useState(String(settings.incursion_sight_reputation ?? 2));
  const [force, setForce] = useState({ biome: '', kind: 'orage', hours: '3' });

  // Un biome peut avoir plusieurs zones : une ligne par type de biome et par temps.
  const rows = useMemo(() => {
    const m = new Map<string, { type: string; kind: string; next: string; count: number; forced: boolean; ids: string[] }>();
    for (const b of weather.biomes) {
      const key = `${b.biome_type}|${b.kind}|${b.next}`;
      const cur = m.get(key) ?? { type: b.biome_type, kind: b.kind, next: b.next, count: 0, forced: false, ids: [] };
      cur.count++;
      cur.forced ||= !!b.forced_until;
      cur.ids.push(b.id);
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => (weather.kinds[b.kind]?.factor ?? 1) - (weather.kinds[a.kind]?.factor ?? 1));
  }, [weather]);
  const changes = new Date(weather.changes_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  async function saveEvents(patch: Partial<{ w: boolean; i: boolean }>) {
    setMsg(null);
    const { error } = await createClient().rpc('map_events_set', {
      p_weather: patch.w ?? null,
      p_incursions: patch.i ?? null,
      p_chance: Math.max(0, Math.min(100, Number(chance) || 0)) / 100,
      p_reputation: Math.max(0, Math.min(100, Math.round(Number(rep) || 0))),
    });
    setMsg(error ? error.message : 'Réglage enregistré.');
    if (!error) onChanged();
  }

  async function forceWeather(clear = false) {
    setMsg(null);
    if (!force.biome) return setMsg('Choisis un biome.');
    const { error } = await createClient().rpc('map_weather_set', {
      p_biome: force.biome,
      p_kind: clear ? '' : force.kind,
      p_hours: Number(force.hours) || 3,
    });
    setMsg(error ? error.message : clear ? 'Retour au temps tiré au sort.' : 'Temps imposé.');
    if (!error) onChanged();
  }

  const isOpen = open || !!focusBiome;
  return (
    <div className={`relative ${isOpen ? 'z-30' : ''}`}>
      {isOpen && (
        <div className="anim-pop glass-strong absolute bottom-full right-0 mb-2 max-h-[60vh] w-72 space-y-3 overflow-y-auto scrollbar-thin rounded-2xl p-4 text-paper">
          <div>
            <p className="font-display text-[10px] uppercase tracking-wide text-accent">Météo des biomes</p>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" className="h-4 w-4 accent-[#d2463b]" checked={shown} onChange={(e) => onShow(e.target.checked)} />
              Dessiner la météo sur la carte
            </label>
            <p className="mt-1 text-xs text-paper/65">Elle change toutes les 3 heures (prochain changement à {changes}). Un trajet prend la pire météo qu&apos;il traverse au départ.</p>
          </div>
          {!weather.enabled ? (
            <p className="text-xs text-paper/70">La météo est coupée.</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-paper/70">Aucun biome sur la carte.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {rows.map((r) => (
                <li
                  key={`${r.type}${r.kind}${r.next}`}
                  className={`rounded-lg border px-2 py-1.5 ${focusBiome && r.ids.includes(focusBiome) ? 'border-accent' : 'border-white/10'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {BIOME_LABELS[r.type] ?? r.type}
                      {r.count > 1 ? ` (${r.count})` : ''}
                    </span>
                    <span className="shrink-0">
                      {WEATHER_GLYPH[r.kind]} {weather.kinds[r.kind]?.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex justify-between gap-2 text-paper/60">
                    <span>{fmtFactor(weather.kinds[r.kind]?.factor ?? 1)}{r.forced ? ' · imposé' : ''}</span>
                    <span>
                      ensuite {WEATHER_GLYPH[r.next]} {weather.kinds[r.next]?.label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {weather.enabled && (weather.places?.length ?? 0) > 0 && (
            <div>
              <p className="font-display text-[10px] uppercase tracking-wide text-accent">Lieux au temps particulier</p>
              <ul className="mt-1.5 space-y-1 text-xs">
                {weather.places!.map((w) => {
                  const p = places.find((x) => x.id === w.id);
                  if (!p || p.fogUnknown) return null;
                  return (
                    <li key={w.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0">
                        {WEATHER_GLYPH[w.kind]} {weather.kinds[w.kind]?.label}
                        {w.fixed_kind ? ' · fixe' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {canEdit && <p className="mt-1 text-[11px] text-paper/60">Les règles d&apos;un lieu se règlent depuis sa fiche.</p>}
            </div>
          )}

          {canEdit && (
            <div className="space-y-2 border-t border-white/10 pt-3 text-xs">
              <p className="font-display text-[10px] uppercase tracking-wide text-accent">Gestion de la carte</p>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[#d2463b]" checked={settings.weather_enabled !== false} onChange={(e) => saveEvents({ w: e.target.checked })} />
                Météo active
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[#d2463b]" checked={settings.incursions_enabled !== false} onChange={(e) => saveEvents({ i: e.target.checked })} />
                Incursions de créatures
              </label>
              {onOpenCreatures && (
                <button onClick={onOpenCreatures} className="btn-accent w-full rounded-lg px-2 py-1.5 font-semibold text-paper">
                  <SidIcon name="claws" /> Gérer les créatures…
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label>
                  Chance par 6 h (%)
                  <input className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm" inputMode="numeric" value={chance} onChange={(e) => setChance(e.target.value)} />
                </label>
                <label>
                  Renommée / signalement
                  <input className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm" inputMode="numeric" value={rep} onChange={(e) => setRep(e.target.value)} />
                </label>
              </div>
              <button onClick={() => saveEvents({})} className="rounded-lg border border-white/15 px-2 py-1 hover:border-accent hover:text-accent">
                Enregistrer
              </button>
              <p className="pt-1 text-paper/70">Imposer un temps</p>
              <select
                className="glass-input w-full rounded-lg px-2 py-1 text-sm"
                style={{ colorScheme: 'dark' }}
                value={force.biome}
                onChange={(e) => setForce({ ...force, biome: e.target.value })}
              >
                <option value="">Biome…</option>
                {biomes.map((b, i) => (
                  <option key={b.id} value={b.id}>
                    {BIOME_LABELS[b.biome_type] ?? b.biome_type} n° {i + 1}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  className="glass-input flex-1 rounded-lg px-2 py-1 text-sm"
                  style={{ colorScheme: 'dark' }}
                  value={force.kind}
                  onChange={(e) => setForce({ ...force, kind: e.target.value })}
                >
                  {Object.entries(weather.kinds).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <input className="glass-input w-14 rounded-lg px-2 py-1 text-sm" inputMode="numeric" aria-label="Heures" value={force.hours} onChange={(e) => setForce({ ...force, hours: e.target.value })} />
                <span className="self-center">h</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => forceWeather()} className="rounded-lg border border-white/15 px-2 py-1 hover:border-accent hover:text-accent">
                  Imposer
                </button>
                <button onClick={() => forceWeather(true)} className="rounded-lg border border-white/15 px-2 py-1 hover:border-accent hover:text-accent">
                  Annuler
                </button>
              </div>
              {msg && <p className="text-paper/70">{msg}</p>}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={isOpen}
        className="glass flex items-center gap-2 rounded-full px-3 py-2 font-display text-[11px] uppercase tracking-wide text-paper hover:text-accent"
      >
        <SidIcon name="wave" /> Météo
      </button>
    </div>
  );
}
