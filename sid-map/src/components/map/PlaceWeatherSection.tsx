'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SidIcon } from '@/components/icons/SidIcon';
import type { MapBiome, MapPlace } from '@/lib/types';
import { WEATHER_GLYPH, WEATHER_KINDS, fmtFactor, placeWeather, type WeatherKind, type WeatherNow } from '@/lib/weather';

type Mode = 'biome' | 'fixe' | 'perso';

/**
 * Météo d'un lieu (migration 0120) : le temps qu'il y fait, et pour la
 * gestion de la carte ses règles (temps fixe, temps interdits, probabilités).
 */
export default function PlaceWeatherSection({
  place,
  biomes,
  weather,
  canEdit,
  onChanged,
}: {
  place: MapPlace;
  biomes: MapBiome[];
  weather: WeatherNow | null;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const rule = weather?.places?.find((p) => p.id === place.id) ?? null;
  const now = placeWeather(place, biomes, weather);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(rule?.fixed_kind ? 'fixe' : rule?.weights ? 'perso' : 'biome');
  const [fixed, setFixed] = useState<WeatherKind>(rule?.fixed_kind ?? 'clair');
  const [forbidden, setForbidden] = useState<WeatherKind[]>(rule?.forbidden ?? []);
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(WEATHER_KINDS.map((k) => [k, String(rule?.weights?.[k] ?? 0)]))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const total = useMemo(
    () => WEATHER_KINDS.filter((k) => !forbidden.includes(k)).reduce((s, k) => s + (Number(weights[k]) || 0), 0),
    [weights, forbidden]
  );

  if (!weather || (!weather.enabled && !canEdit)) return null;
  const label = (k: string) => weather.kinds[k]?.label ?? k;

  async function save(clear = false) {
    setBusy(true);
    setMsg(null);
    const w = Object.fromEntries(
      WEATHER_KINDS.filter((k) => (Number(weights[k]) || 0) > 0).map((k) => [k, Math.round(Number(weights[k]))])
    );
    const { error } = await createClient().rpc('map_place_weather_set', {
      p_place: place.id,
      p_fixed: clear || mode !== 'fixe' ? null : fixed,
      p_forbidden: clear || mode === 'fixe' ? [] : forbidden,
      p_weights: clear || mode !== 'perso' ? null : w,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    if (clear) {
      setMode('biome');
      setForbidden([]);
    }
    setMsg({ ok: true, text: clear ? 'Le lieu suit de nouveau son biome.' : 'Règles enregistrées.' });
    onChanged?.();
  }

  const toggleForbidden = (k: WeatherKind) =>
    setForbidden((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  return (
    <section className="place-weather mt-4">
      <p className="section-label">
        <span aria-hidden>{WEATHER_GLYPH.nuageux}</span> Météo ici
      </p>
      {!weather.enabled ? (
        <p className="mt-1 text-xs text-paper/65">La météo est coupée.</p>
      ) : now ? (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-semibold">
            {WEATHER_GLYPH[now.kind]} {label(now.kind)}
          </span>
          <span className="text-xs text-paper/65">{fmtFactor(weather.kinds[now.kind]?.factor ?? 1)}</span>
          {now.next && now.next !== now.kind && (
            <span className="text-xs text-paper/65">
              · ensuite {WEATHER_GLYPH[now.next]} {label(now.next)}
            </span>
          )}
          {now.own && (
            <span className="tag-own text-[11px]">
              {rule?.fixed_kind ? 'temps fixe' : 'temps propre au lieu'}
            </span>
          )}
        </div>
      ) : null}

      {canEdit && (
        <>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn-ghost mt-2 rounded-lg px-2.5 py-1 text-xs">
            <SidIcon name="tools" /> Règles de météo du lieu
          </button>
          {open && (
            <div className="sheet mt-2 space-y-3 rounded-xl p-3 text-xs">
              <div className="seg-group is-full" role="radiogroup" aria-label="Météo du lieu">
                {(
                  [
                    ['biome', 'Comme son biome'],
                    ['fixe', 'Toujours le même'],
                    ['perso', 'Probabilités propres'],
                  ] as [Mode, string][]
                ).map(([k, l]) => (
                  <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`seg ${mode === k ? 'is-on' : ''}`}>
                    {l}
                  </button>
                ))}
              </div>

              {mode === 'fixe' && (
                <label className="block">
                  Temps permanent
                  <select value={fixed} onChange={(e) => setFixed(e.target.value as WeatherKind)} className="glass-input mt-1 w-full rounded-lg px-2 py-1.5 text-sm">
                    {WEATHER_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {WEATHER_GLYPH[k]} {label(k)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {mode === 'perso' && (
                <div>
                  <p className="mb-1 text-paper/70">Poids de chaque temps (0 : jamais). Les pourcentages sont calculés sur le total.</p>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {WEATHER_KINDS.filter((k) => !forbidden.includes(k)).map((k) => {
                      const v = Number(weights[k]) || 0;
                      return (
                        <li key={k} className="flex items-center gap-1.5">
                          <span className="w-5 text-center" aria-hidden>
                            {WEATHER_GLYPH[k]}
                          </span>
                          <label className="min-w-0 flex-1 truncate" htmlFor={`pw-${k}`}>
                            {label(k)}
                          </label>
                          <input
                            id={`pw-${k}`}
                            inputMode="numeric"
                            value={weights[k]}
                            onChange={(e) => setWeights({ ...weights, [k]: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
                            className="glass-input w-12 rounded-md px-1.5 py-0.5 text-right"
                          />
                          <span className="w-9 text-right text-paper/60">{total > 0 ? `${Math.round((v / total) * 100)} %` : '—'}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {mode !== 'fixe' && (
                <div>
                  <p className="mb-1 text-paper/70">Jamais ici</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WEATHER_KINDS.map((k) => (
                      <button
                        key={k}
                        aria-pressed={forbidden.includes(k)}
                        onClick={() => toggleForbidden(k)}
                        className={`chip ${forbidden.includes(k) ? 'chip-off' : ''}`}
                      >
                        {WEATHER_GLYPH[k]} {label(k)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button disabled={busy} onClick={() => save(false)} className="btn-accent rounded-lg px-3 py-1.5 font-semibold text-paper disabled:opacity-50">
                  Enregistrer
                </button>
                {rule && (
                  <button disabled={busy} onClick={() => save(true)} className="btn-ghost rounded-lg px-3 py-1.5 disabled:opacity-50">
                    Revenir au biome
                  </button>
                )}
                {msg && <span className={msg.ok ? 'text-ok' : 'text-accent'}>{msg.text}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
