'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MapPlace } from '@/lib/types';

/**
 * Carnet de route (Lot 60) : une note privée par lieu, que seul son auteur
 * voit (table map_place_notes, migration 0116). Un petit papier épinglé
 * marque sur la carte les lieux annotés.
 */

export type NoteColor = 'kraft' | 'rouge' | 'vert' | 'bleu';
export type PlaceNote = { place_id: string; body: string; color: NoteColor; updated_at: string };

export const NOTE_COLORS: Record<NoteColor, { label: string; fill: string; ink: string }> = {
  kraft: { label: 'Kraft', fill: '#f1e2b8', ink: '#5b4524' },
  rouge: { label: 'Danger', fill: '#f2b9a8', ink: '#7a2414' },
  vert: { label: 'Bon plan', fill: '#bfe0b4', ink: '#24532a' },
  bleu: { label: 'À revoir', fill: '#bcd3ee', ink: '#1f3f6b' }
};

/** Mes notes (toutes), rechargées après chaque changement. */
export function usePlaceNotes(enabled: boolean) {
  const [notes, setNotes] = useState<Map<string, PlaceNote>>(new Map());
  const refresh = useCallback(async () => {
    const { data, error } = await createClient().from('map_place_notes').select('place_id, body, color, updated_at');
    // Sans la migration 0116, la table n'existe pas : rien n'est affiché.
    if (error) return;
    setNotes(new Map(((data ?? []) as PlaceNote[]).map((n) => [n.place_id, n])));
  }, []);
  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);
  return { notes, refresh };
}

/** Petits papiers épinglés sur les lieux annotés (dans la carte SVG). */
export function NoteMarkers({ notes, places, onOpen }: { notes: Map<string, PlaceNote>; places: MapPlace[]; onOpen: (p: MapPlace) => void }) {
  return (
    <>
      {places.map((p) => {
        const n = notes.get(p.id);
        if (!n) return null;
        const off = (p.shape === 'rect' ? (p.width ?? 6) / 2 : p.radius ?? 3) + 1.6;
        const c = NOTE_COLORS[n.color] ?? NOTE_COLORS.kraft;
        return (
          <g
            key={p.id}
            transform={`translate(${p.x + off}, ${p.y + off * 0.55}) rotate(8)`}
            className="note-marker cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(p);
            }}
          >
            <title>{`Ma note : ${n.body}`}</title>
            <path d="M-1.3 -1.3 H1.3 V0.7 L0.7 1.3 H-1.3 Z" fill={c.fill} stroke="#2e261d" strokeWidth={0.12} />
            <path d="M0.7 1.3 V0.7 H1.3" fill="none" stroke="#2e261d" strokeWidth={0.1} />
            <path d="M-0.8 -0.5 H0.8 M-0.8 0 H0.8 M-0.8 0.5 H0.3" stroke={c.ink} strokeWidth={0.1} strokeLinecap="round" />
            <circle cx={0} cy={-1.3} r={0.32} fill="#b8432c" />
          </g>
        );
      })}
    </>
  );
}

/** Bloc « Ma note » dans la fiche d'un lieu. */
export function PlaceNoteBox({ placeId, myUserId, note, onChanged }: { placeId: string; myUserId: string | null; note: PlaceNote | undefined; onChanged: () => void }) {
  const [body, setBody] = useState(note?.body ?? '');
  const [color, setColor] = useState<NoteColor>(note?.color ?? 'kraft');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [open, setOpen] = useState(!!note);

  useEffect(() => {
    setBody(note?.body ?? '');
    setColor(note?.color ?? 'kraft');
    setOpen(!!note);
  }, [placeId, note]);

  if (!myUserId) return null;
  const dirty = body.trim() !== (note?.body ?? '') || color !== (note?.color ?? 'kraft');

  async function save(text = body.trim()) {
    setState('saving');
    const sb = createClient();
    const { error } = text
      ? await sb.from('map_place_notes').upsert({ user_id: myUserId, place_id: placeId, body: text, color, updated_at: new Date().toISOString() })
      : await sb.from('map_place_notes').delete().eq('user_id', myUserId!).eq('place_id', placeId);
    setState(error ? 'error' : 'saved');
    if (!error) {
      onChanged();
      if (!text) setOpen(false);
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-4 w-full rounded-lg border border-dashed border-white/20 py-2 text-sm text-paper/75 hover:border-accent hover:text-accent">
        ✎ Ajouter une note privée sur ce lieu
      </button>
    );

  const c = NOTE_COLORS[color];
  return (
    <div className="place-note mt-4" style={{ background: c.fill, color: c.ink }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide">Ma note · visible par moi seul</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Couleur de la note">
          {(Object.keys(NOTE_COLORS) as NoteColor[]).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={color === k}
              aria-label={NOTE_COLORS[k].label}
              title={NOTE_COLORS[k].label}
              onClick={() => setColor(k)}
              className={`h-4 w-4 rounded-full border ${color === k ? 'border-[#2e261d] ring-2 ring-[#2e261d]/40' : 'border-[#2e261d]/40'}`}
              style={{ background: NOTE_COLORS[k].fill }}
            />
          ))}
        </div>
      </div>
      <label className="sr-only" htmlFor={`note-${placeId}`}>
        Ma note sur ce lieu
      </label>
      <textarea
        id={`note-${placeId}`}
        value={body}
        maxLength={1000}
        rows={3}
        onChange={(e) => {
          setBody(e.target.value);
          setState('idle');
        }}
        placeholder="Marchand pas cher, chemin dangereux, rendez-vous…"
        className="w-full resize-y bg-transparent text-sm leading-snug outline-none placeholder:text-current placeholder:opacity-50"
        style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
      />
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
        <span aria-live="polite">
          {state === 'saving' ? 'Enregistrement…' : state === 'saved' ? 'Enregistrée ✓' : state === 'error' ? 'Échec de l’enregistrement' : `${body.length}/1000`}
        </span>
        <div className="flex gap-2">
          {note && (
            <button
              onClick={() => {
                setBody('');
                save('');
              }}
              className="underline opacity-75 hover:opacity-100"
            >
              Effacer
            </button>
          )}
          <button disabled={!dirty || state === 'saving'} onClick={() => save()} className="rounded border border-current px-2 py-0.5 font-bold disabled:opacity-40">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
