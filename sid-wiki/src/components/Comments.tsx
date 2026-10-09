'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { WikiComment } from '@/lib/wiki';
import Markdown from './Markdown';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Comments({ category, number }: { category: string; number: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<WikiComment[] | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('wiki_comments_list', { p_category: category, p_number: number });
    if (error) return setError(error.message);
    setComments((data ?? []) as WikiComment[]);
  }, [supabase, category, number]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const { error } = await supabase.rpc('wiki_comment_add', { p_category: category, p_number: number, p_body: body });
    setSending(false);
    if (error) return setError(error.message);
    setBody('');
    load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce commentaire ?')) return;
    const { error } = await supabase.rpc('wiki_comment_delete', { p_id: id });
    if (error) return setError(error.message);
    setComments((cs) => (cs ?? []).filter((c) => c.id !== id));
  }

  return (
    <section className="mt-8 border-t border-white/15 pt-5" id="commentaires">
      <h2 className="mb-3 font-typewriter text-xl font-bold text-olive-800">
        💬 Commentaires {comments ? `(${comments.length})` : ''}
      </h2>

      {comments === null && !error && <p className="italic text-olive-700">Chargement…</p>}
      {comments?.length === 0 && <p className="italic text-olive-700">Aucun commentaire pour l’instant. Sois le premier à raconter ta chasse !</p>}

      <ul className="space-y-3">
        {comments?.map((c) => (
          <li key={c.id} className="rounded-xl border border-white/15 bg-white/[0.09] p-3 backdrop-blur">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-typewriter font-bold text-olive-800">@{c.author_nickname}</span>
                <span className="ml-2 text-olive-700/80">{formatDate(c.created_at)}</span>
              </span>
              {c.can_delete && (
                <button className="text-xs font-bold text-stamp hover:underline" onClick={() => remove(c.id)}>
                  Supprimer
                </button>
              )}
            </div>
            <Markdown>{c.body}</Markdown>
          </li>
        ))}
      </ul>

      <form onSubmit={send} className="mt-4 space-y-2">
        <textarea
          className="input min-h-[6rem]"
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ton commentaire… (markdown, @pseudo pour mentionner un chasseur)"
        />
        {error && <p className="text-sm text-stamp">{error}</p>}
        <button className="btn w-full sm:w-auto" disabled={sending || !body.trim()}>
          {sending ? 'Envoi…' : 'Publier'}
        </button>
      </form>
    </section>
  );
}
