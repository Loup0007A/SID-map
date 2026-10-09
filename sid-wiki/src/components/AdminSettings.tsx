'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Réglages : annonce affichée en haut de l'accueil pour tous les membres. */
export default function AdminSettings() {
  const supabase = createClient();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('wiki_announcement_get').then(({ data }) => {
      const v = typeof data === 'string' ? data : '';
      setText(v);
      setSaved(v);
    });
  }, [supabase]);

  async function save(value: string) {
    setMsg(null);
    const { error } = await supabase.rpc('wiki_announcement_set', { p_text: value });
    if (error) return setError(error.message);
    setError(null);
    setText(value.trim());
    setSaved(value.trim());
    setMsg(value.trim() ? 'Annonce publiée sur l’accueil.' : 'Annonce retirée.');
  }

  return (
    <div className="card max-w-2xl p-5">
      <h2 className="mb-1 font-typewriter text-xl font-bold text-olive-800">📣 Annonce d’accueil</h2>
      <p className="mb-3 text-sm text-olive-700">Un message visible par tous en haut de la page d’accueil (événement, nouveauté, règle…). Laisse vide pour ne rien afficher.</p>
      <textarea className="input min-h-[6rem]" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : Grande chasse ce samedi à 21 h ! 🐉" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn" disabled={text.trim() === saved} onClick={() => save(text)}>
          Publier
        </button>
        {saved && (
          <button className="btn-ghost" onClick={() => save('')}>
            Retirer l’annonce
          </button>
        )}
        <span className="text-xs text-olive-700">{text.length}/500</span>
      </div>
      {error && <p className="mt-2 text-stamp">{error}</p>}
      {msg && <p className="mt-2 font-bold text-olive-700">{msg}</p>}
    </div>
  );
}
