'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { usePermission } from '@/lib/hooks/usePermission';
import { useMountTypes } from '@/lib/hooks/useMountTypes';
import { useNow } from '@/lib/hooks/useNow';
import { BIOME_LABELS, type CharacterPosition, type MountType } from '@/lib/types';
import { formatMinutes } from '@/lib/travel';
import type { MapSettings } from '@/lib/mapScale';
import IconPicker from './IconPicker';

interface LogRow {
  mount_type_id: string | null;
  user_id: string;
  price: number;
  admin_share: number;
}

type Draft = {
  id?: string;
  name: string;
  icon: string;
  speed_multiplier: number;
  can_fly: boolean;
  rental_price: number;
  rental_hours: number;
  flight_speed_kmh: string;
  flight_range_km: string;
  allowed_biomes: string[];
};

const EMPTY: Draft = {
  name: '', icon: '🐴', speed_multiplier: 2, can_fly: false, rental_price: 50,
  rental_hours: 24, flight_speed_kmh: '', flight_range_km: '', allowed_biomes: []
};

export default function MountsModal({
  settings,
  myPosition,
  onClose
}: {
  settings: MapSettings;
  myPosition: CharacterPosition | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const { allowed: isAdmin } = usePermission('manage_map');
  const mounts = useMountTypes();
  const now = useNow(1000);
  const [tab, setTab] = useState<'mine' | 'stats'>('mine');
  const [log, setLog] = useState<LogRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const loadLog = useCallback(async () => {
    const { data } = await supabase.from('mount_rental_log').select('mount_type_id,user_id,price,admin_share');
    setLog((data as LogRow[]) ?? []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  const active = mounts.byId(myPosition?.active_mount_id ?? null);
  const remainingMs = myPosition?.mount_expires_at ? new Date(myPosition.mount_expires_at).getTime() - now : null;

  function effectiveKmh(m: MountType) {
    return m.can_fly && m.flight_speed_kmh ? m.flight_speed_kmh : settings.walk_kmh * (m.speed_multiplier || 1);
  }

  function toDraft(m: MountType): Draft {
    return {
      id: m.id, name: m.name, icon: m.icon, speed_multiplier: Number(m.speed_multiplier), can_fly: m.can_fly,
      rental_price: Number(m.rental_price), rental_hours: Number(m.rental_hours ?? 24),
      flight_speed_kmh: m.flight_speed_kmh ? String(m.flight_speed_kmh) : '',
      flight_range_km: m.flight_range_km ? String(m.flight_range_km) : '',
      allowed_biomes: m.allowed_biomes ?? []
    };
  }

  async function save() {
    if (!draft || !draft.name.trim()) return showToast('Donne un nom à la monture.', 'error');
    setSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const payload = {
      name: draft.name.trim(),
      icon: draft.icon,
      speed_multiplier: draft.speed_multiplier,
      can_fly: draft.can_fly,
      rental_price: draft.rental_price,
      rental_hours: draft.rental_hours > 0 ? draft.rental_hours : 24,
      flight_speed_kmh: draft.can_fly && Number(draft.flight_speed_kmh) > 0 ? Number(draft.flight_speed_kmh) : null,
      flight_range_km: draft.can_fly && Number(draft.flight_range_km) > 0 ? Number(draft.flight_range_km) : null,
      allowed_biomes: draft.allowed_biomes.length > 0 ? draft.allowed_biomes : null
    };
    const { error } = draft.id
      ? await supabase.from('mount_types').update(payload).eq('id', draft.id)
      : await supabase.from('mount_types').insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (error) showToast("Impossible d'enregistrer la monture.", 'error');
    else {
      showToast('Monture enregistrée.');
      setDraft(null);
      mounts.reload();
    }
  }

  async function remove(m: MountType) {
    if (!confirm(`Supprimer « ${m.name} » ? Ses locations disparaissent aussi.`)) return;
    await supabase.from('mount_types').delete().eq('id', m.id);
    mounts.reload();
  }

  const field = 'w-full glass-input rounded-lg px-2 py-1.5 text-xs outline-none';

  // --- Formulaire (admin) ---
  if (draft) {
    return (
      <Modal
        title={draft.id ? 'Modifier la monture' : 'Nouvelle monture'}
        onClose={() => setDraft(null)}
        maxWidth="max-w-sm"
        footer={
          <button onClick={save} disabled={saving} className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        }
      >
        <div className="space-y-2.5">
          <input placeholder="Nom (ex : Aigle géant)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} />
          <IconPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
          <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wide text-paper/50">
            <label>
              Vitesse ×
              <input type="number" step={0.5} min={0.5} value={draft.speed_multiplier} onChange={(e) => setDraft({ ...draft, speed_multiplier: Number(e.target.value) })} className={field} />
            </label>
            <label>
              Prix (🪙)
              <input type="number" min={0} value={draft.rental_price} onChange={(e) => setDraft({ ...draft, rental_price: Number(e.target.value) })} className={field} />
            </label>
            <label>
              Durée de location (h)
              <input type="number" min={1} value={draft.rental_hours} onChange={(e) => setDraft({ ...draft, rental_hours: Number(e.target.value) })} className={field} />
            </label>
            <label className="flex items-end gap-2 pb-1.5 normal-case text-xs text-paper/70">
              <input type="checkbox" checked={draft.can_fly} onChange={(e) => setDraft({ ...draft, can_fly: e.target.checked })} className="h-4 w-4 accent-[#b3261e]" />
              Vole (sans chemin)
            </label>
          </div>
          {draft.can_fly && (
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder={`Vitesse de vol (${settings.unit_label}/h)`} value={draft.flight_speed_kmh} onChange={(e) => setDraft({ ...draft, flight_speed_kmh: e.target.value })} className={field} />
              <input type="number" placeholder={`Portée max (${settings.unit_label})`} value={draft.flight_range_km} onChange={(e) => setDraft({ ...draft, flight_range_km: e.target.value })} className={field} />
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-paper/50">Biomes traversables</p>
            <p className="text-[10px] text-paper/40">Aucun coché = tous les biomes. Sinon la monture ne peut pas traverser les autres.</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(BIOME_LABELS).map(([k, label]) => {
                const on = draft.allowed_biomes.includes(k);
                return (
                  <label key={k} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${on ? 'border-accent bg-accent/10 text-paper' : 'border-white/10 text-paper/60'}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setDraft({ ...draft, allowed_biomes: on ? draft.allowed_biomes.filter((b) => b !== k) : [...draft.allowed_biomes, k] })
                      }
                      className="h-3.5 w-3.5 accent-[#b3261e]"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  const tabBtn = (t: 'mine' | 'stats', label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${tab === t ? 'bg-accent text-paper' : 'text-paper/60 hover:text-paper'}`}
    >
      {label}
    </button>
  );

  return (
    <Modal
      title="🐎 Montures"
      onClose={onClose}
      maxWidth="max-w-sm"
      top={<div className="flex gap-1 rounded-lg border border-white/15 bg-white/5 p-0.5">{tabBtn('mine', 'Ma monture')}{tabBtn('stats', '📊 Stats')}</div>}
    >
      {tab === 'mine' ? (
        <div className="space-y-3 text-sm">
          {active ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-2xl">{active.icon}</p>
              <p className="text-paper">{active.name}</p>
              {remainingMs !== null && (
                <p className="mt-1 text-xs text-accent">
                  {remainingMs > 0 ? `Expire dans ${formatMinutes(remainingMs / 60000)}` : 'Expirée'}
                </p>
              )}
              <p className="mt-1 text-xs text-paper/60">
                {active.can_fly ? 'Vole sans chemin' : 'Suit les routes'} · ×{active.speed_multiplier}
              </p>
            </div>
          ) : (
            <p className="text-xs text-paper/50">
              Tu n'as pas de monture. Rends-toi dans un lieu qui en propose (fiche du lieu → « Montures louables »). Une location dure {` 24 h par défaut`}.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {mounts.mountTypes.length === 0 && <p className="text-xs text-paper/50">Aucune monture créée.</p>}
          {mounts.mountTypes.map((m) => {
            const rows = log.filter((l) => l.mount_type_id === m.id);
            const revenue = rows.reduce((a, r) => a + Number(r.admin_share), 0);
            const mine = rows.filter((r) => r.user_id === myPosition?.user_id).length;
            const biomes = m.allowed_biomes && m.allowed_biomes.length > 0 ? m.allowed_biomes.map((b) => BIOME_LABELS[b] ?? b).join(', ') : 'Tous';
            return (
              <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-paper">
                    {m.icon} {m.name}
                  </p>
                  {isAdmin && (
                    <span className="flex gap-2">
                      <button onClick={() => setDraft(toDraft(m))} className="text-paper/60 hover:text-accent">✎</button>
                      <button onClick={() => remove(m)} className="text-paper/60 hover:text-accent">🗑</button>
                    </span>
                  )}
                </div>
                <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-paper/70">
                  <dt className="text-paper/40">Déplacement</dt><dd>{m.can_fly ? '🕊️ Vol libre' : '🛣 Routes'}</dd>
                  <dt className="text-paper/40">Vitesse</dt><dd>×{m.speed_multiplier} · {Math.round(effectiveKmh(m))} {settings.unit_label}/h</dd>
                  {m.can_fly && (
                    <>
                      <dt className="text-paper/40">Portée</dt>
                      <dd>{m.flight_range_km ? `${m.flight_range_km} ${settings.unit_label}` : 'Illimitée'}</dd>
                    </>
                  )}
                  <dt className="text-paper/40">Location</dt><dd>{m.rental_price} 🪙 / {m.rental_hours ?? 24} h</dd>
                  <dt className="text-paper/40">Biomes</dt><dd>{biomes}</dd>
                  <dt className="text-paper/40">Locations</dt><dd>{isAdmin ? rows.length : mine}{isAdmin ? ` · ${revenue.toFixed(0)} 🪙 aux admins` : ' (les tiennes)'}</dd>
                </dl>
              </div>
            );
          })}
          {isAdmin && (
            <button onClick={() => setDraft({ ...EMPTY })} className="w-full rounded-lg border border-dashed border-accent/40 py-2 text-xs text-accent hover:bg-accent/10">
              + Nouvelle monture
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
