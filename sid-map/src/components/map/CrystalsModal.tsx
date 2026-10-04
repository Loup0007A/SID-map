'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { usePermission } from '@/lib/hooks/usePermission';
import OwnerPicker from '@/components/city/OwnerPicker';
import type { MapPlace, TeleportCrystal } from '@/lib/types';
import type { usePositions } from '@/lib/hooks/usePositions';

const ERRORS: Record<string, string> = {
  crystal_not_found: 'Cristal introuvable.',
  already_used: 'Ce cristal est déjà utilisé.',
  wrong_place: "Tu n'es pas au lieu de départ du cristal.",
  currently_traveling: 'Tu es en voyage.'
};

export default function CrystalsModal({
  places,
  positionsHook,
  onClose
}: {
  places: MapPlace[];
  positionsHook: ReturnType<typeof usePositions>;
  onClose: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const { allowed: isAdmin } = usePermission('manage_map');
  const { myUserId, myPosition } = positionsHook;
  const [crystals, setCrystals] = useState<TeleportCrystal[]>([]);
  const [busy, setBusy] = useState(false);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [holderId, setHolderId] = useState<string | null>(null);
  const [holderLabel, setHolderLabel] = useState('');
  const [single, setSingle] = useState(true);
  const [label, setLabel] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? '?';

  const load = useCallback(async () => {
    const { data } = await supabase.from('teleport_crystals').select('*').order('created_at', { ascending: false });
    setCrystals((data as TeleportCrystal[]) ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const mine = crystals.filter((c) => c.holder_id === myUserId && !(c.is_single_use && c.used_at));

  async function use(c: TeleportCrystal) {
    setBusy(true);
    const { data, error } = await supabase.rpc('use_teleport_crystal', { p_crystal_id: c.id });
    setBusy(false);
    const err = error?.message ?? data?.error;
    if (err) showToast(ERRORS[err] ?? 'Téléportation impossible.', 'error');
    else {
      showToast(`Téléporté vers ${placeName(c.to_place_id)} !`);
      positionsHook.reload();
      load();
      onClose();
    }
  }

  async function give() {
    if (!from || !to || from === to || !holderId) return;
    setBusy(true);
    const { error } = await supabase.from('teleport_crystals').insert({
      from_place_id: from,
      to_place_id: to,
      holder_id: holderId,
      is_single_use: single,
      label: label.trim() || 'Cristal de téléportation',
      created_by: myUserId
    });
    setBusy(false);
    if (error) showToast('Création impossible.', 'error');
    else {
      showToast('Cristal donné.');
      setLabel('');
      load();
    }
  }

  async function revoke(id: string) {
    if (!confirm('Retirer ce cristal ?')) return;
    await supabase.from('teleport_crystals').delete().eq('id', id);
    load();
  }

  const selectCls = 'w-full glass-input rounded-lg px-2.5 py-1.5 text-xs';

  return (
    <>
      <Modal title="💎 Cristaux de téléportation" onClose={onClose} maxWidth="max-w-sm">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-paper/50">Mes cristaux</p>
            {mine.length === 0 && <p className="text-xs text-paper/40">Tu n'as aucun cristal.</p>}
            <div className="space-y-1.5">
              {mine.map((c) => {
                const here = myPosition?.place_id === c.from_place_id && !myPosition?.travel_started_at;
                return (
                  <div key={c.id} className="rounded-lg bg-white/5 p-2 text-xs">
                    <p className="text-paper">
                      {c.label} <span className="text-paper/40">· {c.is_single_use ? 'usage unique' : 'continu'}</span>
                    </p>
                    <p className="text-paper/60">
                      {placeName(c.from_place_id)} → {placeName(c.to_place_id)}
                    </p>
                    <button
                      disabled={busy || !here}
                      onClick={() => use(c)}
                      className="btn-accent mt-1.5 rounded-md px-2.5 py-1 text-[11px] text-paper disabled:opacity-40"
                    >
                      {here ? 'Utiliser' : `À utiliser depuis ${placeName(c.from_place_id)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {isAdmin && (
            <div className="border-t border-white/10 pt-3">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-paper/50">Admin · donner un cristal</p>
              <div className="space-y-1.5">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Nom (optionnel)"
                  className="w-full glass-input rounded-lg px-2.5 py-1.5 text-xs outline-none"
                />
                <select value={from} onChange={(e) => setFrom(e.target.value)} style={{ colorScheme: 'dark' }} className={selectCls}>
                  <option value="">Lieu de départ…</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select value={to} onChange={(e) => setTo(e.target.value)} style={{ colorScheme: 'dark' }} className={selectCls}>
                  <option value="">Lieu d'arrivée…</option>
                  {places.filter((p) => p.id !== from).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowPicker(true)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-left text-xs text-paper/70 hover:border-accent"
                >
                  {holderId ? `👤 ${holderLabel}` : '👤 Choisir le joueur…'}
                </button>
                <label className="flex items-center gap-2 text-xs text-paper/70">
                  <input
                    type="checkbox"
                    checked={single}
                    onChange={(e) => setSingle(e.target.checked)}
                    className="h-4 w-4 accent-[#b3261e]"
                  />
                  Usage unique (décoché = continu)
                </label>
                <button
                  onClick={give}
                  disabled={busy || !from || !to || !holderId}
                  className="btn-accent w-full rounded-lg px-3 py-1.5 text-xs text-paper disabled:opacity-40"
                >
                  Donner le cristal
                </button>
              </div>

              <p className="mb-1 mt-3 text-[11px] uppercase tracking-wide text-paper/50">Cristaux existants</p>
              <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin pr-1">
                {crystals.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1 text-[11px]">
                    <span className="truncate text-paper/70">
                      {placeName(c.from_place_id)} → {placeName(c.to_place_id)} · {c.is_single_use ? '1×' : '∞'}
                      {c.used_at ? ' (utilisé)' : ''}
                    </span>
                    <button onClick={() => revoke(c.id)} className="ml-2 text-paper/40 hover:text-accent">
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
      {showPicker && (
        <OwnerPicker
          currentOwnerId={holderId}
          onClose={() => setShowPicker(false)}
          onSelect={(id, lbl) => {
            setHolderId(id);
            setHolderLabel(lbl ?? '');
            setShowPicker(false);
          }}
        />
      )}
    </>
  );
}
