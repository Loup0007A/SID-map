'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CharacterPosition, MapPlace, MapQuest } from '@/lib/types';
import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Tableau des quêtes d'un lieu (Lot 59) : rang, récompense, places restantes,
 * échéance. Sur place, on prend la quête d'ici même ; ailleurs, « Y aller »
 * ouvre l'itinéraire vers le lieu.
 */

type Detail = {
  id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  deadline: string | null;
  max_participants: number | null;
  reward: number | null;
  reputation_reward: number | null;
};

const QUEST_SITE = 'https://sid-quest.vercel.app';

function due(deadline: string | null) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'échéance passée';
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return 'moins d’une heure';
  if (h < 48) return `encore ${h} h`;
  return `encore ${Math.round(h / 24)} j`;
}

export default function QuestPopup({
  place,
  quests,
  myPos,
  myUserId,
  onClose,
  onGo,
  onToast
}: {
  place: MapPlace;
  quests: MapQuest[];
  myPos: CharacterPosition | null;
  myUserId: string | null;
  onClose: () => void;
  onGo: (placeId: string) => void;
  onToast: (msg: string, type?: 'error') => void;
}) {
  const supabase = createClient();
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const ids = quests.map((q) => q.id).join(',');

  async function load() {
    const list = ids.split(',').filter(Boolean);
    const [d, c, m] = await Promise.all([
      supabase
        .from('quests')
        .select('id, title, description, difficulty, deadline, max_participants, reward, reputation_reward')
        .in('id', list),
      supabase.rpc('quest_participant_counts'),
      myUserId ? supabase.from('quest_participants').select('quest_id').eq('user_id', myUserId).in('quest_id', list) : null
    ]);
    setDetails(Object.fromEntries(((d.data ?? []) as Detail[]).map((x) => [x.id, x])));
    setCounts(Object.fromEntries(((c.data ?? []) as { quest_id: string; participant_count: number }[]).map((x) => [x.quest_id, x.participant_count])));
    setMine(new Set(((m?.data ?? []) as { quest_id: string }[]).map((x) => x.quest_id)));
  }

  useEffect(() => {
    load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, myUserId]);

  const onPlace = !!myPos && myPos.place_id === place.id && !myPos.travel_started_at;

  async function take(q: MapQuest) {
    if (!myUserId) return;
    setBusy(q.id);
    const { error } = await supabase.from('quest_participants').insert({ quest_id: q.id, user_id: myUserId });
    setBusy(null);
    if (error) {
      onToast(error.message.includes('duplicate') ? 'Tu as déjà cette quête.' : error.message, 'error');
      return;
    }
    onToast('Quête prise ! Reste une heure sur place pour la valider.');
    load();
  }

  return (
    <div
      className="quest-board glass-strong absolute bottom-20 left-3 z-30 flex max-h-[min(60vh,520px)] w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl text-paper md:bottom-6"
      role="dialog"
      aria-label={`Quêtes à ${place.name}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <p className="font-display text-[10px] uppercase tracking-[0.2em] text-accent">Tableau des quêtes</p>
          <p className="truncate font-semibold">{place.name}</p>
          <p className="text-[11px] text-paper/70">
            {onPlace ? (
              <>
                <SidIcon name="pin" /> Tu es ici : tu peux prendre ces quêtes.
              </>
            ) : (
              'Ces quêtes se prennent sur place.'
            )}
          </p>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="rounded px-1 text-paper/70 hover:text-accent">
          ✕
        </button>
      </div>

      <ul className="flex-1 space-y-2 overflow-y-auto p-3">
        {quests.map((q) => {
          const d = details[q.id];
          const n = counts[q.id] ?? 0;
          const full = d?.max_participants != null && n >= d.max_participants;
          const taken = mine.has(q.id);
          const reward = Number(d?.reward ?? q.reward ?? 0);
          const left = due(d?.deadline ?? null);
          return (
            <li key={q.id} className="quest-slip">
              <div className="flex items-start gap-2">
                {d?.difficulty && <span className="quest-rank" title={`Rang ${d.difficulty}`}>{d.difficulty}</span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-[#3a2c1a]">{q.title}</p>
                  {d?.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-[#5b4a33]">{d.description}</p>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#4a3b26]">
                <span>
                  <SidIcon name="coins" /> {reward.toLocaleString('fr-FR')} z
                </span>
                {d?.reputation_reward ? <span><SidIcon name="medal" /> +{d.reputation_reward}</span> : null}
                <span>
                  <SidIcon name="people" /> {n}
                  {d?.max_participants != null ? ` / ${d.max_participants}` : ''}
                </span>
                {left && <span><SidIcon name="hourglass" /> {left}</span>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                {taken ? (
                  <span className="quest-taken">
                    <SidIcon name="check" /> Prise
                  </span>
                ) : onPlace ? (
                  <button className="btn-accent !py-1 !text-xs" disabled={full || busy === q.id} onClick={() => take(q)}>
                    {full ? 'Complète' : busy === q.id ? '…' : 'Prendre la quête'}
                  </button>
                ) : (
                  <button className="btn-accent !py-1 !text-xs" onClick={() => onGo(place.id)}>
                    <SidIcon name="road" /> Y aller
                  </button>
                )}
                <a
                  href={`${QUEST_SITE}/dashboard/quests?quete=${q.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-[11px] text-[#7a5a1e] underline"
                >
                  Dossier Central →
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
