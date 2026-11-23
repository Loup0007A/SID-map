'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BRAND } from '@/lib/brand';
import { usePermission } from '@/lib/hooks/usePermission';
import { useNow } from '@/lib/hooks/useNow';
import type { Incursion } from '@/lib/hooks/useMapEvents';
import { SidIcon } from '@/components/icons/SidIcon';

function left(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

/** Bandeau de la créature : la suivre, la signaler, ouvrir sa fiche, lancer une chasse. */
export default function IncursionCard({
  incursion,
  open,
  onToggle,
  onFocus,
  onChanged,
  toast,
  onManage,
  onHide,
}: {
  /** Masquer complètement ce signalement (panneau et marqueur). */
  onHide: () => void;
  /** Gestion de la carte : ouvrir la gestion des créatures. */
  onManage?: () => void;
  incursion: Incursion;
  open: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onChanged: () => void;
  toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const now = useNow(15000);
  const { allowed: canQuest } = usePermission('manage_quests');
  const [busy, setBusy] = useState(false);
  const unknown = !!incursion.entry.unknown || incursion.entry.number == null;
  const name = incursion.entry.title ?? 'Une créature';
  const wikiHref = unknown ? null : `${BRAND.urls.wiki}/${incursion.entry.category}/${String(incursion.entry.number).padStart(3, '0')}`;

  async function sight() {
    setBusy(true);
    const { data, error } = await createClient().rpc('incursion_sight', { p_incursion: incursion.id });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    const r = data as { reputation: number; revealed?: boolean };
    toast(
      r.revealed
        ? `Tu es le premier à la voir : elle entre dans le Wiki${r.reputation ? ` (+${r.reputation} de renommée)` : ''}.`
        : `Signalement enregistré${r.reputation ? ` (+${r.reputation} de renommée)` : ''}.`,
      'success'
    );
    onChanged();
  }

  async function hunt() {
    setBusy(true);
    const { error } = await createClient().rpc('incursion_hunt_quest', { p_incursion: incursion.id });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    toast('Quête de chasse publiée.', 'success');
    onChanged();
  }

  return (
      <div className="incursion-card pointer-events-auto glass-strong w-full max-w-md overflow-hidden rounded-2xl text-paper">
        <div className="flex items-center">
        <button onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left">
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-[#c0392b]">
            {incursion.entry.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={incursion.entry.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-black/40 font-display">{unknown ? '?' : '!'}</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[10px] uppercase tracking-[0.2em] text-[#e58a7c]">Incursion en cours</span>
            <span className="block truncate font-display text-base">{name} rôde</span>
            <span className="block text-xs text-paper/65">
              Repart dans {left(new Date(incursion.ends_at).getTime() - now)} · {incursion.sightings} signalement{incursion.sightings > 1 ? 's' : ''}
            </span>
          </span>
          <span aria-hidden className={`text-paper/60 transition ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <button
          onClick={onHide}
          aria-label="Masquer ce signalement"
          title="Masquer ce signalement (Légende pour le réafficher)"
          className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-paper/70 hover:bg-white/10 hover:text-paper"
        >
          ×
        </button>
        </div>
        {open && (
          <div className="space-y-2 border-t border-white/10 p-3">
            {incursion.entry.summary && <p className="text-sm text-paper/80">{incursion.entry.summary}</p>}
            <p className="text-xs text-paper/60">
              Arrête-toi sur un lieu à moins de {Math.round(incursion.reach * incursion.km_per_unit)} km d&apos;elle (cercle pointillé) pour la signaler. Chaque signalement complète sa fiche dans le Wiki.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={onFocus} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:border-accent hover:text-accent">
                <SidIcon name="compass" /> Voir sur la carte
              </button>
              <button
                onClick={sight}
                disabled={busy || incursion.seen_by_me}
                className="btn-accent rounded-lg px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-50"
              >
                {incursion.seen_by_me ? 'Déjà signalée' : 'Signaler'}
              </button>
              {wikiHref && (
                <a href={wikiHref} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:border-accent hover:text-accent">
                  <SidIcon name="book" /> Fiche
                </a>
              )}
              {onManage && (
                <button onClick={onManage} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs hover:border-accent hover:text-accent">
                  <SidIcon name="tools" /> Gérer
                </button>
              )}
              {canQuest && !incursion.quest_id && (
                <button onClick={hunt} disabled={busy} className="rounded-lg border border-[#e7c34a]/50 px-3 py-1.5 text-xs text-[#e7c34a] hover:bg-[#e7c34a]/10 disabled:opacity-50">
                  <SidIcon name="bow" /> Lancer une chasse
                </button>
              )}
              {incursion.quest_id && <span className="self-center text-xs text-[#e7c34a]">Quête de chasse ouverte</span>}
            </div>
          </div>
        )}
      </div>
  );
}
