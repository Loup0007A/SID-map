'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MapComment } from '@/lib/types';

export default function CommentsBox({
  targetType,
  targetId
}: {
  targetType: 'zone' | 'place' | 'building';
  targetId: string;
}) {
  const supabase = createClient();
  const [comments, setComments] = useState<MapComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.rpc('list_map_comments', {
      p_target_type: targetType,
      p_target_id: targetId
    });
    setComments((data as MapComment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('map_comments').insert({
      target_type: targetType,
      target_id: targetId,
      user_id: user.id,
      content: text.trim()
    });

    setText('');
    setPosting(false);
    load();
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-sm uppercase tracking-wide text-accent">Commentaires</h3>

      <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-thin pr-1">
        {loading && <p className="text-xs text-paper/50">Chargement…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-paper/50">Aucun commentaire pour l'instant.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className=" border border-paper/10 bg-panel p-2 text-sm">
            <p className="text-paper/90">{c.content}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-paper/40">
              {c.member_rank ?? 'Membre'} · {new Date(c.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un commentaire…"
          className="flex-1  border border-paper/20 bg-ink px-2 py-1.5 text-sm outline-none focus:border-accent"
          onKeyDown={(e) => e.key === 'Enter' && post()}
        />
        <button
          onClick={post}
          disabled={posting}
          className=" bg-accent px-3 py-1.5 text-sm font-medium text-ink hover:brightness-110 disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
