'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';

// Le roster peut exposer le nom du membre sous différentes clés selon
// la config du premier site. On teste d'abord les noms les plus
// courants, puis on retombe sur une heuristique : le premier champ
// texte "plausible" (pas un id, une url, ou un champ technique connu).
const KNOWN_NAME_KEYS = [
  'username',
  'pseudo',
  'pseudonyme',
  'display_name',
  'displayname',
  'full_name',
  'fullname',
  'name',
  'nom',
  'rp_name',
  'character_name',
  'ic_name',
  'discord_username',
  'discord_name'
];
const EXCLUDED_KEYS = new Set([
  'id',
  'user_id',
  'status',
  'member_rank',
  'avatar_url',
  'hidden_fields',
  'is_founder',
  'is_muted',
  'created_at',
  'updated_at',
  'zone_id',
  'city_id'
]);

function looksLikeId(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) || /^[0-9a-f]{20,}$/i.test(v);
}

function displayName(p: any): string {
  for (const key of KNOWN_NAME_KEYS) {
    if (typeof p[key] === 'string' && p[key].trim()) return p[key];
  }
  for (const [key, value] of Object.entries(p)) {
    if (EXCLUDED_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.trim() && !value.startsWith('http') && !looksLikeId(value) && value.length < 60) {
      return value;
    }
  }
  return p.id;
}

export default function OwnerPicker({
  onClose,
  onSelect,
  currentOwnerId
}: {
  onClose: () => void;
  onSelect: (id: string | null, label: string | null) => void;
  currentOwnerId?: string | null;
}) {
  const supabase = createClient();
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    supabase.rpc('list_roster').then(({ data }) => {
      setRoster((data as any[]) ?? []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? roster.filter((p) => displayName(p).toLowerCase().includes(q))
      : roster;
    return base.slice(0, 40);
  }, [roster, query]);

  return (
    <Modal title="Rechercher un membre" onClose={onClose}>
      <div className="space-y-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tape un nom pour chercher dans le roster…"
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
        />

        {currentOwnerId && (
          <button
            onClick={() => onSelect(null, null)}
            className="w-full rounded-lg border border-accent/40 px-3 py-2 text-left text-xs text-accent hover:bg-accent/10"
          >
            ✕ Retirer le propriétaire actuel
          </button>
        )}

        <div className="max-h-72 space-y-1 overflow-y-auto scrollbar-thin pr-1">
          {loading && <p className="text-xs text-paper/50">Chargement du roster…</p>}
          {!loading && results.length === 0 && (
            <p className="text-xs text-paper/50">Aucun membre trouvé.</p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id, displayName(p))}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-white/10 ${
                p.id === currentOwnerId ? 'bg-accent/15' : ''
              }`}
            >
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs">
                  {displayName(p).slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-paper">{displayName(p)}</p>
                {p.member_rank && (
                  <p className="text-[10px] uppercase tracking-wide text-paper/40">{p.member_rank}</p>
                )}
              </div>
              {p.id === currentOwnerId && <span className="text-accent">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
