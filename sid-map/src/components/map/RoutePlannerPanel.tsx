'use client';

import Icon from '@/components/ui/Icon';

import { useEffect, useMemo, useState } from 'react';
import type { MapPlace, MapRoute } from '@/lib/types';
import { findShortestPath, routeWeight, type RoutePlan, type RouteStep } from '@/lib/pathfinding';
import { formatMinutes } from '@/lib/travel';
import { SidIcon, GlyphText } from '@/components/icons/SidIcon';
import { createClient } from '@/lib/supabase/client';
import ScheduledTrips from './ScheduledTrips';

function PlacePicker({
  label,
  places,
  value,
  onChange
}: {
  label: string;
  places: MapPlace[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = places.find((p) => p.id === value);
  const results = query.trim()
    ? places.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wide text-paper/65">{label}</label>
      <input
        value={selected ? selected.name : query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        onFocus={() => setQuery('')}
        placeholder="Rechercher…"
        className="w-full glass-input rounded-lg px-3 py-1.5 text-sm outline-none"
      />
      {results.length > 0 && (
        <div className="max-h-32 space-y-0.5 overflow-y-auto scrollbar-thin">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p.id);
                setQuery('');
              }}
              className="block w-full rounded-lg px-2 py-1 text-left text-xs text-paper/80 hover:bg-white/10"
            >
              <Icon value={p.icon ?? '📍'} /> {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Quand = 'maintenant' | 'depart' | 'arrivee';
type Estimation = { minutes?: number; to_place_id?: string; from_place_id?: string; error?: string; message?: string };

/** « 2026-11-24T18:30:00 » (heure locale) pour un champ datetime-local. */
function versChamp(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const heure = (d: Date) =>
  d.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function autreBout(r: MapRoute, from: string) {
  return r.from_place_id === from ? r.to_place_id : r.to_place_id === from ? r.from_place_id : null;
}

export default function RoutePlannerPanel({
  places,
  routes,
  onClose,
  onHighlight,
  myPlaceId = null,
  traveling = false,
  speedMultiplier = 1,
  mountName = null,
  canFly = false,
  onStart,
  onFlyNow,
  initialToId = null,
  bare = false
}: {
  /** destination déjà choisie (bouton « Y aller ») */
  initialToId?: string | null;
  /** sans cadre ni titre : le contenu est posé dans une fenêtre */
  bare?: boolean;
  places: MapPlace[];
  routes: MapRoute[];
  onClose: () => void;
  onHighlight: (plan: RoutePlan | null) => void;
  /** lieu où se trouve mon personnage (départ par défaut) */
  myPlaceId?: string | null;
  traveling?: boolean;
  speedMultiplier?: number;
  mountName?: string | null;
  /** monture volante équipée : le vol direct est proposé */
  canFly?: boolean;
  /** lance le trajet ; pauses = minutes d'arrêt après l'étape i ; renvoie true s'il est parti */
  onStart?: (plan: RoutePlan, pauses: Record<number, number>) => Promise<boolean>;
  /** vol direct immédiat */
  onFlyNow?: (toPlaceId: string) => Promise<boolean>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [fromId, setFromId] = useState<string | null>(myPlaceId);
  const [toId, setToId] = useState<string | null>(initialToId);
  const [starting, setStarting] = useState(false);
  // Itinéraire choisi route par route (null = le plus court).
  const [manual, setManual] = useState<RouteStep[] | null>(null);
  const [pauses, setPauses] = useState<Record<number, number>>({});
  const [vol, setVol] = useState(false);
  const [quand, setQuand] = useState<Quand>('maintenant');
  const [heureChamp, setHeureChamp] = useState(() => versChamp(new Date(Math.ceil((Date.now() + 10 * 60000) / 60000) * 60000)));
  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const [listeCle, setListeCle] = useState(0);

  // Mon lieu arrive après l'ouverture (chargement) : on le prend comme départ.
  useEffect(() => {
    if (myPlaceId && !fromId) setFromId(myPlaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlaceId]);

  const shortest = useMemo(() => {
    if (!fromId || !toId) return null;
    return findShortestPath(fromId, toId, routes);
  }, [fromId, toId, routes]);

  const steps: RouteStep[] = useMemo(() => manual ?? shortest?.steps ?? [], [manual, shortest]);
  const endId = steps.length ? steps[steps.length - 1].toPlaceId : fromId;

  const plan: RoutePlan | null = useMemo(() => {
    if (vol || !fromId) return null;
    if (!manual) return shortest;
    return {
      steps: manual,
      totalMinutes: manual.reduce((s, st) => s + routeWeight(st.route), 0),
      placeIds: [fromId, ...manual.map((st) => st.toPlaceId)]
    };
  }, [vol, fromId, manual, shortest]);

  useEffect(() => {
    onHighlight(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Changer de départ efface le tracé manuel et les pauses.
  useEffect(() => {
    setManual(null);
    setPauses({});
  }, [fromId]);
  useEffect(() => {
    if (!manual) setPauses({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toId]);

  const speed = speedMultiplier > 0 ? speedMultiplier : 1;
  const fromMe = !!myPlaceId && fromId === myPlaceId;
  const pauseTotal = Object.entries(pauses)
    .filter(([i]) => Number(i) < steps.length - 1)
    .reduce((s, [, m]) => s + m, 0);
  const marche = plan ? plan.totalMinutes / speed : 0;

  // Ce qui part au serveur (0123).
  const items = useMemo(() => {
    if (vol) return toId ? [{ vol_vers: toId }] : [];
    const out: Record<string, unknown>[] = [];
    steps.forEach((st, i) => {
      out.push({ route_id: st.route.id, to_place_id: st.toPlaceId });
      const p = pauses[i];
      if (p && i < steps.length - 1) out.push({ pause_minutes: p });
    });
    return out;
  }, [vol, toId, steps, pauses]);

  const instant = useMemo(() => {
    if (quand === 'maintenant') return null;
    const d = new Date(heureChamp);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [quand, heureChamp]);

  // Estimation serveur (même règle qu'au lancement, sans la météo du jour J).
  useEffect(() => {
    setEstimation(null);
    if (quand === 'maintenant' || items.length === 0 || !instant) return;
    let annule = false;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('trajet_estimer', { p_plan: items, p_depart: quand === 'depart' ? instant.toISOString() : null });
      if (annule) return;
      if (error) setEstimation({ error: 'rpc', message: error.message });
      else setEstimation(data as Estimation);
    }, 350);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [supabase, quand, items, instant]);

  function ajouter(r: MapRoute) {
    if (!endId) return;
    const to = autreBout(r, endId);
    if (!to) return;
    setManual([...steps, { route: r, fromPlaceId: endId, toPlaceId: to }]);
  }
  function retirer() {
    const next = steps.slice(0, -1);
    setManual(next);
    setPauses((p) => {
      const q = { ...p };
      delete q[next.length - 1];
      delete q[next.length];
      return q;
    });
  }
  function completer() {
    if (!endId || !toId) return;
    const rest = findShortestPath(endId, toId, routes);
    if (rest) setManual([...steps, ...rest.steps]);
  }

  async function partir() {
    setErreur(null);
    if (vol) {
      if (!onFlyNow || !toId) return;
      setStarting(true);
      const ok = await onFlyNow(toId);
      setStarting(false);
      if (ok) onClose();
      return;
    }
    if (!plan || !onStart) return;
    setStarting(true);
    const ok = await onStart(plan, Object.fromEntries(Object.entries(pauses).filter(([i]) => Number(i) < steps.length - 1)));
    setStarting(false);
    if (ok) {
      onHighlight(null);
      onClose();
    }
  }

  async function programmer() {
    if (!instant || items.length === 0) return;
    setErreur(null);
    setFait(null);
    setStarting(true);
    const { data, error } = await supabase.rpc('trajet_programmer', {
      p_plan: items,
      p_depart: quand === 'depart' ? instant.toISOString() : null,
      p_arrivee: quand === 'arrivee' ? instant.toISOString() : null
    });
    setStarting(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    const t = data as { depart_at: string; minutes_estimees: number };
    const dep = new Date(t.depart_at);
    setFait(`Programmé : départ ${heure(dep)}, arrivée prévue ${heure(new Date(dep.getTime() + Number(t.minutes_estimees) * 60000))}.`);
    setListeCle((k) => k + 1);
  }

  const voisins = endId && !vol
    ? routes
        .filter((r) => autreBout(r, endId))
        .map((r) => ({ r, to: places.find((p) => p.id === autreBout(r, endId)) }))
        .filter((x) => x.to)
        .sort((a, b) => a.to!.name.localeCompare(b.to!.name, 'fr'))
    : [];
  const nom = (id: string | null | undefined) => places.find((p) => p.id === id)?.name ?? '?';

  const pret = vol ? !!toId && toId !== fromId : steps.length > 0;
  const canStartNow = pret && fromMe && !traveling && (vol ? !!onFlyNow : !!onStart);
  const estDepart = estimation?.from_place_id ?? null;

  let horaire: string | null = null;
  let tropTot = false;
  if (instant && estimation && estimation.minutes != null && !estimation.error) {
    const ms = Number(estimation.minutes) * 60000;
    const depart = quand === 'depart' ? instant : new Date(Math.floor((instant.getTime() - ms) / 1000) * 1000);
    tropTot = depart.getTime() < Date.now();
    horaire = tropTot
      ? quand === 'depart'
        ? 'Cette heure est déjà passée : choisis un départ plus tardif'
        : `Il faudrait partir ${heure(depart)}, heure déjà passée : choisis une arrivée plus tardive`
      : quand === 'depart'
        ? `Arrivée prévue ${heure(new Date(instant.getTime() + ms))}`
        : `Départ calculé ${heure(depart)}`;
  }

  return (
    <div className={bare ? 'space-y-3' : 'glass-strong max-h-[65vh] w-72 space-y-3 overflow-y-auto rounded-2xl p-3 scrollbar-thin'}>
      <div className={bare ? 'hidden' : 'flex items-center justify-between'}>
        <p className="font-display text-[10px] uppercase tracking-wide text-accent"><SidIcon name="compass" /> Itinéraire</p>
        <button
          onClick={() => {
            onHighlight(null);
            onClose();
          }}
          aria-label="Fermer"
          className="text-paper/65 hover:text-accent"
        >
          ✕
        </button>
      </div>

      <PlacePicker label="Départ" places={places} value={fromId} onChange={setFromId} />
      {myPlaceId && !fromMe && (
        <button onClick={() => setFromId(myPlaceId)} className="-mt-2 text-[11px] text-accent underline">
          Partir de ma position
        </button>
      )}
      <PlacePicker label="Arrivée" places={places} value={toId} onChange={setToId} />

      {canFly && (
        <label className="flex items-center gap-2 text-xs text-paper/80">
          <input type="checkbox" checked={vol} onChange={(e) => setVol(e.target.checked)} />
          <span><SidIcon name="dove" /> En vol direct ({mountName ?? 'monture volante'})</span>
        </label>
      )}

      {fromId && (toId || manual) && !vol && (
        <div className="border-t border-white/10 pt-2 text-sm">
          {steps.length === 0 && !manual ? (
            shortest ? (
              <p className="text-paper/65">Départ et arrivée sont le même lieu.</p>
            ) : (
              <p className="text-paper/65">Aucun itinéraire trouvé entre ces deux lieux.</p>
            )
          ) : (
            <>
              <p className="text-accent">
                <SidIcon name="clock" /> {formatMinutes(marche + pauseTotal)} {mountName && speed !== 1 ? `(${mountName})` : 'à pied'}
                {pauseTotal > 0 && <span className="text-paper/65"> dont {formatMinutes(pauseTotal)} de pause</span>}
              </p>
              <ol className="mt-1.5 space-y-1 text-xs text-paper/75">
                <li>
                  <Icon value={places.find((p) => p.id === fromId)?.icon ?? '📍'} /> {nom(fromId)}
                </li>
                {steps.map((st, i) => (
                  <li key={`${st.route.id}-${i}`} className="space-y-1">
                    <p>
                      → <Icon value={places.find((p) => p.id === st.toPlaceId)?.icon ?? '📍'} /> {nom(st.toPlaceId)}{' '}
                      <span className="text-paper/55">({formatMinutes(routeWeight(st.route) / speed)})</span>
                    </p>
                    {i < steps.length - 1 &&
                      (pauses[i] ? (
                        <p className="flex items-center gap-1.5 pl-4 text-paper/70">
                          <SidIcon name="clock" /> Pause
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            value={pauses[i]}
                            aria-label={`Minutes de pause à ${nom(st.toPlaceId)}`}
                            onChange={(e) => setPauses((p) => ({ ...p, [i]: Math.max(1, Math.min(1440, Math.round(Number(e.target.value) || 1))) }))}
                            className="glass-input w-16 rounded px-1.5 py-0.5 text-xs outline-none"
                          />
                          min
                          <button
                            onClick={() => setPauses((p) => { const q = { ...p }; delete q[i]; return q; })}
                            aria-label="Retirer la pause"
                            className="text-paper/55 hover:text-accent"
                          >
                            ✕
                          </button>
                        </p>
                      ) : (
                        <button onClick={() => setPauses((p) => ({ ...p, [i]: 15 }))} className="pl-4 text-[11px] text-accent/90 underline">
                          + pause ici
                        </button>
                      ))}
                  </li>
                ))}
              </ol>

              {manual ? (
                <div className="mt-2 space-y-1.5 rounded-lg border border-white/10 p-2">
                  <label className="block text-[10px] uppercase tracking-wide text-paper/65" htmlFor="route-suivante">
                    Route suivante depuis {nom(endId)}
                  </label>
                  <select
                    id="route-suivante"
                    value=""
                    onChange={(e) => {
                      const r = routes.find((x) => x.id === e.target.value);
                      if (r) ajouter(r);
                    }}
                    className="glass-input w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  >
                    <option value="">Choisir…</option>
                    {voisins.map(({ r, to }) => (
                      <option key={r.id} value={r.id}>
                        {to!.name} ({formatMinutes(routeWeight(r) / speed)}){r.name ? ` par ${r.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                    {steps.length > 0 && (
                      <button onClick={retirer} className="text-accent underline">Retirer la dernière route</button>
                    )}
                    {toId && endId !== toId && (
                      <button onClick={completer} className="text-accent underline">Compléter jusqu’à {nom(toId)}</button>
                    )}
                    <button onClick={() => { setManual(null); setPauses({}); }} className="text-paper/65 underline">Revenir au plus court</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setManual(steps)} className="mt-1.5 text-[11px] text-accent underline">
                  Choisir les routes une à une
                </button>
              )}
            </>
          )}
        </div>
      )}

      {pret && (
        <div className="space-y-2 border-t border-white/10 pt-2">
          <div role="radiogroup" aria-label="Quand partir" className="grid grid-cols-3 gap-1 text-[11px]">
            {(
              [
                ['maintenant', 'Maintenant'],
                ['depart', 'Partir à'],
                ['arrivee', 'Arriver à']
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                role="radio"
                aria-checked={quand === k}
                onClick={() => setQuand(k)}
                className={`rounded-lg px-1 py-1.5 ${quand === k ? 'bg-accent/25 text-paper ring-1 ring-accent/60' : 'bg-white/5 text-paper/70 hover:bg-white/10'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {quand === 'maintenant' ? (
            <>
              <button
                onClick={partir}
                disabled={!canStartNow || starting}
                className="btn-accent w-full rounded-lg py-2 text-xs font-semibold text-paper disabled:opacity-40"
              >
                <GlyphText text={starting ? 'Départ…' : vol ? '🕊️ S’envoler' : steps.length > 1 ? `🚶 Partir (${steps.length} étapes)` : '🚶 Partir'} />
              </button>
              {traveling ? (
                <p className="text-[11px] text-paper/65">Tu es déjà en route : programme ce trajet pour plus tard (Partir à).</p>
              ) : !myPlaceId ? (
                <p className="text-[11px] text-paper/65">Choisis d’abord où commence ton personnage (Ma position).</p>
              ) : !fromMe ? (
                <p className="text-[11px] text-paper/65">Pour partir maintenant, le départ doit être ta position actuelle.</p>
              ) : null}
            </>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-paper/65">
                  {quand === 'depart' ? 'Heure de départ' : 'Heure d’arrivée voulue'} (à la seconde)
                </span>
                <input
                  type="datetime-local"
                  step={1}
                  value={heureChamp}
                  onChange={(e) => setHeureChamp(e.target.value)}
                  className="glass-input w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                />
              </label>
              {estimation?.error ? (
                <p className="text-[11px] text-red-300">{estimation.message ?? 'Trajet impossible.'}</p>
              ) : horaire ? (
                <p className={`text-[11px] ${tropTot ? 'text-red-300' : 'text-paper/80'}`}>
                  {horaire}{tropTot ? '.' : `, ${formatMinutes(Number(estimation!.minutes))} de trajet.`}
                </p>
              ) : (
                <p className="text-[11px] text-paper/55">Calcul…</p>
              )}
              {estDepart && estDepart !== fromId && !vol && (
                <p className="text-[11px] text-paper/70">
                  À cette heure, tu seras à {nom(estDepart)}.{' '}
                  <button onClick={() => setFromId(estDepart)} className="text-accent underline">En partir</button>
                </p>
              )}
              <button
                onClick={programmer}
                disabled={starting || !instant || !!estimation?.error || tropTot}
                className="btn-accent w-full rounded-lg py-2 text-xs font-semibold text-paper disabled:opacity-40"
              >
                <GlyphText text={starting ? 'Enregistrement…' : '⏱ Programmer ce trajet'} />
              </button>
              <p className="text-[11px] text-paper/55">
                Les durées sont figées au départ, avec la météo de ce moment-là. Le trajet part même page fermée.
              </p>
            </>
          )}
          {erreur && <p role="alert" className="text-[11px] text-red-300">{erreur}</p>}
          {fait && <p role="status" className="text-[11px] text-green-300">{fait}</p>}
        </div>
      )}

      <ScheduledTrips refreshKey={listeCle} />
    </div>
  );
}
