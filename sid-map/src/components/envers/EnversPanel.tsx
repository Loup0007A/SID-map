'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { SidIcon } from '@/components/icons/SidIcon';
import EnversBackdrop from './EnversBackdrop';
import EnversAdmin from './EnversAdmin';

export type EnversState = {
  access: boolean;
  is_admin?: boolean;
  now?: string;
  inside?: boolean;
  entered_at?: string | null;
  last_tick_at?: string | null;
  ends_at?: string | null;
  speed_kmh?: number;
  session_km?: number;
  km_total?: number;
  found_count?: number;
  session_hours?: number;
  km_multiplier?: number;
  traveling?: boolean;
  has_position?: boolean;
  balance?: number | null;
  items?: { id: string; name: string; description: string | null; price: number; stock: number | null }[];
  purchases?: { name: string; quantity: number; total: number; at: string }[];
};

const ERRORS: Record<string, string> = {
  no_access: "La faille s'est refermée : retrouve-la pour revenir.",
  no_position: "Il te faut d'abord une position sur la carte (application « Ma position »).",
  currently_traveling: 'Tu es en voyage : reviens une fois arrivé.',
  item_not_found: "Cet article n'est plus sur l'étagère.",
  out_of_stock: "Il n'en reste plus assez.",
  insufficient_funds: "Tu n'as pas assez d'argent.",
  invalid_quantity: 'Quantité invalide.'
};

const nf = (v: number, d = 0) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function EnversPanel({
  first,
  onClose,
  onPickSpot
}: {
  first: boolean;
  onClose: () => void;
  onPickSpot: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [state, setState] = useState<EnversState | null>(null);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const skew = useRef(0); // horloge du serveur - horloge locale

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('envers_state');
    const s = (data ?? { access: false }) as EnversState;
    if (s.now) skew.current = new Date(s.now).getTime() - Date.now();
    setState(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Le compteur avance tout seul entre deux nouvelles du serveur.
  useEffect(() => {
    if (!state?.inside) return;
    const id = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(id);
  }, [state?.inside]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function call(fn: string, args?: Record<string, unknown>, ok?: string) {
    setBusy(true);
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    const err = (data as { error?: string } | null)?.error;
    if (error || err) {
      showToast(ERRORS[err ?? ''] ?? 'Ça n’a pas marché.', 'error');
      return false;
    }
    if (ok) showToast(ok, 'success');
    await load();
    return true;
  }

  const now = Date.now() + skew.current;
  let liveKm = state?.session_km ?? 0;
  let leftPct = 0;
  if (state?.inside && state.last_tick_at && state.ends_at && state.entered_at) {
    const until = Math.min(now, new Date(state.ends_at).getTime());
    liveKm += (Math.max(0, until - new Date(state.last_tick_at).getTime()) / 3_600_000) * (state.speed_kmh ?? 0);
    const span = new Date(state.ends_at).getTime() - new Date(state.entered_at).getTime();
    leftPct = span > 0 ? Math.min(100, Math.max(0, ((until - new Date(state.entered_at).getTime()) / span) * 100)) : 100;
  }
  const totalKm = (state?.km_total ?? 0) - (state?.session_km ?? 0) + liveKm;

  return (
    <div className="envers-panel fixed inset-0 z-[65] overflow-y-auto" role="dialog" aria-modal="true" aria-label="L'Envers">
      <EnversBackdrop className="fixed" />

      <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="envers-rise">
            <p className="font-display text-[11px] tracking-widest2 text-[#9aa6c4]">De l’autre côté de la feuille</p>
            <h1 className="envers-title">L’Envers</h1>
            <p className="mt-2 max-w-xl font-serif text-[17px] italic leading-snug text-[#c9d1e2]">
              {first
                ? 'La carte a cédé sous tes doigts. Ici, le dos du vélin : ce qui est loin de l’autre côté est tout près, et les chemins se parcourent tout seuls.'
                : 'Le dos du vélin. Ce qui est loin de l’autre côté est tout près, et les chemins se parcourent tout seuls.'}
            </p>
          </div>
          <button onClick={onClose} className="envers-btn-ghost shrink-0 self-end sm:self-auto" title="Échap">
            Recoudre la carte
          </button>
        </div>

        {!state ? (
          <p className="mt-10 font-serif italic text-[#9aa6c4]">Les yeux s’habituent à l’obscurité…</p>
        ) : !state.access ? (
          <div className="envers-card mt-8">
            <p className="font-serif text-[#c9d1e2]">La faille s’est déjà refermée.</p>
          </div>
        ) : (
          <>
            {/* ----------------------------------------------- Le Chemin sans fin */}
            <section className="envers-card envers-rise mt-8" style={{ animationDelay: '0.12s' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="envers-h2">Le Chemin sans fin</h2>
                <span className="text-xs text-[#9aa6c4]">
                  ×{nf(state.km_multiplier ?? 2)} ton allure · {nf(state.speed_kmh ?? 0, (state.speed_kmh ?? 0) % 1 ? 1 : 0)} km/h
                </span>
              </div>

              {state.inside ? (
                <>
                  <div className="mt-4 flex items-end gap-3">
                    <span className="envers-counter">{nf(liveKm, 2)}</span>
                    <span className="mb-2 font-display text-sm text-[#9aa6c4]">km parcourus sans bouger</span>
                  </div>
                  <div className="envers-track mt-4" aria-hidden>
                    <div className="envers-track-fill" style={{ width: `${leftPct}%` }} />
                    <div className="envers-walker" style={{ left: `${leftPct}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-[#c9d1e2]">
                    Le chemin te porte jusqu’à <strong className="text-[#efe4c8]">{state.ends_at ? hhmm(state.ends_at) : '—'}</strong>, même si tu
                    fermes la carte. Partir en voyage te ramène de l’autre côté.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => call('envers_leave', undefined, 'Tu reviens du bon côté de la carte.')} className="envers-btn-ghost">
                      Revenir de l’autre côté
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#c9d1e2]">
                    Pose ton bagage et laisse le chemin défiler : tu avances deux fois plus vite que ta propre allure (à pied, ou sur ta
                    monture louée), sans bouger d’ici, pendant {nf(state.session_hours ?? 12)} h au plus. Chaque kilomètre compte comme de
                    la distance parcourue.
                  </p>
                  <div className="mt-4">
                    {state.traveling ? (
                      <p className="text-sm text-[#e8b98a]">Tu es en voyage : le chemin ne t’attendra qu’une fois arrivé.</p>
                    ) : !state.has_position ? (
                      <p className="text-sm text-[#e8b98a]">Il te faut d’abord une position sur la carte.</p>
                    ) : (
                      <button disabled={busy} onClick={() => call('envers_enter', undefined, 'Le chemin se met à défiler.')} className="envers-btn">
                        Prendre le chemin
                      </button>
                    )}
                  </div>
                </>
              )}
              <p className="mt-4 border-t border-[#c9d3e6]/10 pt-3 text-xs text-[#9aa6c4]">
                Depuis ta première venue : <span className="text-[#efe4c8]">{nf(totalKm, 1)} km</span> parcourus dans L’Envers.
              </p>
            </section>

            {/* ----------------------------------------------- Le Comptoir */}
            <section className="envers-card envers-rise mt-6" style={{ animationDelay: '0.24s' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="envers-h2">Le Comptoir de l’Envers</h2>
                {state.balance != null && (
                  <span className="text-xs text-[#9aa6c4]">
                    Ta bourse : <span className="text-[#efe4c8]">{nf(Number(state.balance))}</span> <SidIcon name="coins" size={13} />
                  </span>
                )}
              </div>
              <p className="mt-1 font-serif text-sm italic text-[#9aa6c4]">On ne demande pas d’où ça vient. On ne dit pas où ça va.</p>

              {(state.items ?? []).length === 0 ? (
                <p className="mt-4 text-sm text-[#9aa6c4]">Les étagères sont vides pour l’instant.</p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {state.items!.map((it) => {
                    const q = Math.max(1, qty[it.id] ?? 1);
                    const out = it.stock !== null && it.stock <= 0;
                    return (
                      <li key={it.id} className="envers-item">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display text-[15px] text-[#efe4c8]">{it.name}</p>
                          <p className="shrink-0 text-sm text-[#e7c873]">
                            {nf(Number(it.price))} <SidIcon name="coins" size={13} />
                          </p>
                        </div>
                        {it.description && <p className="mt-1 text-[13px] leading-snug text-[#b5bfd4]">{it.description}</p>}
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={it.stock ?? 999}
                            value={q}
                            onChange={(e) => setQty((m) => ({ ...m, [it.id]: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))}
                            className="envers-input w-16"
                            aria-label={`Quantité de ${it.name}`}
                          />
                          <button
                            disabled={busy || out}
                            onClick={() => call('envers_buy', { p_item_id: it.id, p_quantity: q }, `Acheté : ${it.name}${q > 1 ? ` ×${q}` : ''}.`)}
                            className="envers-btn !py-1.5"
                          >
                            {out ? 'Épuisé' : 'Acheter'}
                          </button>
                          <span className="ml-auto text-[11px] text-[#9aa6c4]">{it.stock === null ? '' : `${it.stock} en stock`}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {(state.purchases ?? []).length > 0 && (
                <div className="mt-5">
                  <p className="font-display text-xs text-[#9aa6c4]">Ce que tu as rapporté</p>
                  <ul className="mt-2 divide-y divide-[#c9d3e6]/10 text-sm">
                    {state.purchases!.map((p, i) => (
                      <li key={i} className="flex justify-between gap-3 py-1.5 text-[#c9d1e2]">
                        <span>
                          {p.name}
                          {p.quantity > 1 ? ` ×${p.quantity}` : ''}
                        </span>
                        <span className="shrink-0 text-[#9aa6c4]">
                          {nf(Number(p.total))} <SidIcon name="coins" size={12} /> · {new Date(p.at).toLocaleDateString('fr-FR')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {state.is_admin && <EnversAdmin onPickSpot={onPickSpot} onChanged={load} />}

            <p className="mt-10 text-center font-serif text-sm italic text-[#7d88a6]">Ne dis à personne où la feuille est fragile.</p>
          </>
        )}
      </div>
    </div>
  );
}
