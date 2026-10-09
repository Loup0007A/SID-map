'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Bloc-notes privé par fiche : visible uniquement par son auteur. */
export default function PersonalNote({ category, number }: { category: string; number: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc('wiki_note_get', { p_category: category, p_number: number }).then(({ data }) => {
      if (!alive) return;
      const v = typeof data === 'string' ? data : '';
      setText(v);
      setSaved(v);
      setOpen(v.length > 0);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [supabase, category, number]);

  async function save() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('wiki_note_set', { p_category: category, p_number: number, p_body: text });
    setBusy(false);
    if (error) return setError(error.message);
    setSaved(text.trim());
    setText(text.trim());
  }

  const dirty = text.trim() !== saved;

  return (
    <section className="no-print mt-8 border-t border-white/15 pt-4">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <h2 className="font-typewriter text-lg font-bold text-olive-800">📝 Mes notes {saved && <span className="text-sm font-normal text-olive-700">(enregistrées)</span>}</h2>
        <span className="text-olive-700">{open ? '▲' : '▼'}</span>
      </button>
      {open && loaded && (
        <div className="mt-2">
          <textarea
            className="input min-h-[7rem]"
            maxLength={5000}
            placeholder="Tes astuces, tes stratégies… Seul toi peux voir ces notes."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" className="btn" disabled={busy || !dirty} onClick={save}>
              {busy ? 'Enregistrement…' : 'Enregistrer la note'}
            </button>
            <span className="text-xs text-olive-700">🔒 Privé · {text.length}/5000</span>
            {error && <span className="text-sm text-stamp">{error}</span>}
          </div>
        </div>
      )}
      {!open && !loaded && <p className="mt-1 text-sm italic text-olive-700">Chargement…</p>}
    </section>
  );
}
