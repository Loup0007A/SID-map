'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SidIcon } from '@/components/icons/SidIcon';
import type { ExplorationState } from '@/lib/hooks/useExploration';

type Leader = { nickname: string; places: number; discovered: number; me: boolean };

/** Bouton « Exploration » et son panneau : avancement, régions, explorateurs, réglages. */
export default function ExplorationPanel({
  state,
  preview,
  onPreview,
  onChanged,
}: {
  state: ExplorationState;
  preview: boolean;
  onPreview: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const [radius, setRadius] = useState(String(state.radius));
  const [msg, setMsg] = useState<string | null>(null);
  const pct = state.total ? Math.round((state.explored / state.total) * 100) : 0;

  useEffect(() => {
    if (!open || leaders) return;
    createClient()
      .rpc('exploration_leaderboard', { p_limit: 8 })
      .then(({ data }) => setLeaders((data as Leader[]) ?? []));
  }, [open, leaders]);

  async function save(enabled: boolean) {
    setMsg(null);
    const r = Number(radius.replace(',', '.'));
    const { error } = await createClient().rpc('map_fog_set', { p_enabled: enabled, p_radius: r > 0 ? r : null });
    if (error) return setMsg(error.message);
    setMsg('Réglage enregistré.');
    onChanged();
  }

  const C = 2 * Math.PI * 15;
  return (
    <div className={`relative ${open ? 'z-30' : ''}`}>
      {open && (
        <div className="anim-pop glass-strong absolute bottom-full right-0 mb-2 max-h-[60vh] w-72 space-y-3 overflow-y-auto scrollbar-thin rounded-2xl p-4 text-paper">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 36 36" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth="3.2" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="#e7c34a" strokeWidth="3.2" strokeLinecap="round" strokeDasharray={`${(C * pct) / 100} ${C}`} />
            </svg>
            <div>
              <p className="font-display text-xl leading-none">{pct} %</p>
              <p className="mt-1 text-xs text-paper/70">
                {state.explored} lieu{state.explored > 1 ? 'x' : ''} exploré{state.explored > 1 ? 's' : ''} sur {state.total}
              </p>
            </div>
          </div>
          <p className="text-xs text-paper/65">
            Voyage pour dévoiler la carte. Les lieux marqués d&apos;un « ? » sont à une route de toi. Le premier à atteindre un lieu nouveau en devient le découvreur.
          </p>

          {state.zones.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-display text-[10px] uppercase tracking-wide text-accent">Régions</p>
              {state.zones.map((z) => (
                <div key={z.id} className="text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">{z.visited ? z.name : 'Région inconnue'}</span>
                    <span className="text-paper/60">
                      {z.visited}/{z.total}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#e7c34a]" style={{ width: `${z.total ? (z.visited / z.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <p className="font-display text-[10px] uppercase tracking-wide text-accent">Explorateurs</p>
            {!leaders ? (
              <p className="text-xs text-paper/60">Chargement…</p>
            ) : leaders.length === 0 ? (
              <p className="text-xs text-paper/60">Personne pour l&apos;instant.</p>
            ) : (
              <ol className="space-y-0.5 text-xs">
                {leaders.map((l, i) => (
                  <li key={i} className={`flex justify-between gap-2 ${l.me ? 'text-[#e7c34a]' : ''}`}>
                    <span className="truncate">
                      {i + 1}. {l.nickname}
                    </span>
                    <span className="shrink-0 text-paper/60">
                      {l.places} lieu{l.places > 1 ? 'x' : ''}
                      {l.discovered ? ` · ${l.discovered} découvert${l.discovered > 1 ? 's' : ''}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {state.bypass && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="font-display text-[10px] uppercase tracking-wide text-accent">Gestion de la carte</p>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="h-4 w-4 accent-[#d2463b]" checked={state.enabled} onChange={(e) => save(e.target.checked)} />
                Brouillard pour les membres
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="h-4 w-4 accent-[#d2463b]" checked={preview} disabled={!state.enabled} onChange={(e) => onPreview(e.target.checked)} />
                Voir la carte comme un membre
              </label>
              <label className="block text-xs">
                Rayon dévoilé autour d&apos;un lieu
                <span className="mt-1 flex gap-2">
                  <input className="glass-input w-20 rounded-lg px-2 py-1 text-sm" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />
                  <button type="button" onClick={() => save(state.enabled)} className="rounded-lg border border-white/15 px-2 py-1 text-xs hover:border-accent hover:text-accent">
                    Enregistrer
                  </button>
                </span>
              </label>
              {msg && <p className="text-xs text-paper/70">{msg}</p>}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="glass flex items-center gap-2 rounded-full px-3 py-2 font-display text-[11px] uppercase tracking-wide text-paper hover:text-accent"
      >
        <SidIcon name="compass" /> Exploration · {pct} %
      </button>
    </div>
  );
}
