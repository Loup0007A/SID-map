'use client';

import Icon from '@/components/ui/Icon';

import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { CharacterPosition, MapPlace, MapRoute } from '@/lib/types';
import { distanceKm, formatDistance, type MapSettings } from '@/lib/mapScale';
import { formatMinutes } from '@/lib/travel';
import { routeWeight } from '@/lib/pathfinding';

const row = 'flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-[#e7c34a]/50 hover:bg-white/10';
const chip = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${active ? 'bg-accent text-paper' : 'border border-white/15 text-paper/70 hover:text-accent'}`;

// --- 📖 Répertoire : tous les lieux, filtrables, avec les présences ------
export function DirectoryApp({
  places,
  positions,
  favoriteIds,
  typeLabel,
  typeIcon,
  onGo,
  onClose
}: {
  places: MapPlace[];
  positions: CharacterPosition[];
  favoriteIds: string[];
  typeLabel: (key: string) => string;
  typeIcon: (key: string) => string;
  onGo: (p: MapPlace) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string | 'all' | 'fav'>('all');

  const here = useMemo(() => {
    const m = new Map<string, number>();
    positions.forEach((p) => {
      if (p.place_id && !p.travel_started_at) m.set(p.place_id, (m.get(p.place_id) ?? 0) + 1);
    });
    return m;
  }, [positions]);

  const types = useMemo(() => Array.from(new Set(places.map((p) => p.type))), [places]);
  const q = query.trim().toLowerCase();
  const list = places
    .filter((p) => (type === 'all' ? true : type === 'fav' ? favoriteIds.includes(p.id) : p.type === type))
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <Modal
      title="📖 Répertoire"
      windowId="directory"
      maxWidth="max-w-sm"
      onClose={onClose}
      top={
        <div className="space-y-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer par nom…" className="glass-input w-full rounded-lg px-3 py-1.5 text-sm outline-none" />
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button onClick={() => setType('all')} className={chip(type === 'all')}>
              Tous ({places.length})
            </button>
            <button onClick={() => setType('fav')} className={chip(type === 'fav')}>
              ★ Favoris
            </button>
            {types.map((t) => (
              <button key={t} onClick={() => setType(t)} className={chip(type === t)}>
                {typeIcon(t)} {typeLabel(t)}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="anim-stagger space-y-1.5">
        {places.length === 0 && <p className="py-4 text-center text-sm text-paper/50">Aucun lieu n’existe encore sur la carte.</p>}
        {places.length > 0 && list.length === 0 && <p className="py-4 text-center text-sm text-paper/50">Aucun lieu ne correspond à ce filtre.</p>}
        {list.map((p) => (
          <button key={p.id} onClick={() => onGo(p)} className={row}>
            <span aria-hidden className="text-lg"><Icon value={p.icon || typeIcon(p.type)} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-paper">
                {p.name}
                {favoriteIds.includes(p.id) && <span className="ml-1 text-[#e7c34a]">★</span>}
              </span>
              <span className="block truncate text-[11px] text-paper/50">{typeLabel(p.type)}</span>
            </span>
            {(here.get(p.id) ?? 0) > 0 && (
              <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-300" title="Personnages présents">
                👤 {here.get(p.id)}
              </span>
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
}

// --- 📡 À proximité : lieux les plus proches de mon personnage ----------
export function NearbyApp({
  places,
  routes,
  myPlaceId,
  settings,
  speedMultiplier,
  onGo,
  onOpenPosition,
  onClose
}: {
  places: MapPlace[];
  routes: MapRoute[];
  myPlaceId: string | null;
  settings: MapSettings;
  speedMultiplier: number;
  onGo: (p: MapPlace) => void;
  onOpenPosition: () => void;
  onClose: () => void;
}) {
  const me = places.find((p) => p.id === myPlaceId) ?? null;
  const list = me
    ? places
        .filter((p) => p.id !== me.id)
        .map((p) => {
          const km = distanceKm(me, p, settings);
          const route = routes.find((r) => (r.from_place_id === me.id && r.to_place_id === p.id) || (r.to_place_id === me.id && r.from_place_id === p.id));
          return { p, km, route };
        })
        .sort((a, b) => a.km - b.km)
        .slice(0, 15)
    : [];

  return (
    <Modal title="📡 À proximité" windowId="nearby" maxWidth="max-w-sm" onClose={onClose}>
      {!me ? (
        <div className="space-y-3 py-2 text-center">
          <p className="text-sm text-paper/70">Ton personnage n’a pas encore de position : impossible de savoir ce qui est proche.</p>
          <button onClick={onOpenPosition} className="btn-accent rounded-lg px-4 py-2 text-sm font-semibold text-paper">
            Choisir mon lieu
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-paper/55">
            Depuis <span className="text-paper"><Icon value={me.icon ?? '📍'} /> {me.name}</span>, du plus proche au plus loin. Les distances sont à vol d’oiseau.
          </p>
          {list.length === 0 && <p className="py-3 text-center text-sm text-paper/50">Aucun autre lieu sur la carte.</p>}
          <div className="anim-stagger space-y-1.5">
            {list.map(({ p, km, route }) => (
              <button key={p.id} onClick={() => onGo(p)} className={row}>
                <span aria-hidden className="text-lg"><Icon value={p.icon ?? '📍'} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-paper">{p.name}</span>
                  <span className="block truncate text-[11px] text-paper/50">
                    {route
                      ? `🛣 Route directe · ${formatMinutes(routeWeight(route) / (speedMultiplier || 1))}`
                      : 'Pas de route directe'}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-[#e7c34a]">{formatDistance(km, settings.unit_label)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// --- 📓 Carnet : notes personnelles, gardées sur l'appareil -------------
const NOTES_KEY = 'sid-notes';

export function NotesApp({ currentPlaceName, onClose }: { currentPlaceName: string | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<'saved' | 'saving' | 'error'>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      setText(localStorage.getItem(NOTES_KEY) ?? '');
    } catch {
      setState('error');
    }
    setLoaded(true);
  }, []);

  function persist(value: string) {
    try {
      localStorage.setItem(NOTES_KEY, value);
      setState('saved');
    } catch {
      setState('error');
    }
  }

  function update(value: string) {
    setText(value);
    setState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(value), 400);
  }

  // Ne rien perdre si la fenêtre se ferme avant la fin du délai.
  const latest = useRef(text);
  latest.current = text;
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        try {
          localStorage.setItem(NOTES_KEY, latest.current);
        } catch {
          // stockage indisponible
        }
      }
    },
    []
  );

  function stamp() {
    const d = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    const line = `— ${d}${currentPlaceName ? `, ${currentPlaceName}` : ''} —\n`;
    update(text ? `${text.replace(/\s+$/, '')}\n\n${line}` : line);
  }

  return (
    <Modal
      title="📓 Carnet"
      windowId="notes"
      maxWidth="max-w-sm"
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2 text-[11px]">
          <span className={state === 'error' ? 'text-accent' : 'text-paper/50'}>
            {state === 'error' ? 'Enregistrement impossible sur cet appareil' : state === 'saving' ? 'Enregistrement…' : `Enregistré · ${text.length} caractères`}
          </span>
          <button onClick={stamp} className="ml-auto rounded-lg border border-white/15 px-2.5 py-1 text-paper/75 hover:border-accent hover:text-accent">
            + Date et lieu
          </button>
          <button
            onClick={() => {
              if (text && confirm('Effacer tout le carnet ?')) update('');
            }}
            disabled={!text}
            className="rounded-lg border border-white/15 px-2.5 py-1 text-paper/60 hover:border-accent hover:text-accent disabled:opacity-30"
          >
            Effacer
          </button>
        </div>
      }
    >
      <textarea
        value={text}
        disabled={!loaded}
        onChange={(e) => update(e.target.value)}
        placeholder="Indices, rendez-vous, dettes, rumeurs… Tes notes restent sur cet appareil : personne d’autre ne les voit."
        className="glass-input h-56 min-h-[8rem] w-full resize-y rounded-xl px-3 py-2.5 text-sm leading-relaxed text-paper outline-none"
      />
    </Modal>
  );
}
