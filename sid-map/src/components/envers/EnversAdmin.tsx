'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { SidIcon } from '@/components/icons/SidIcon';

type Config = {
  x: number;
  y: number;
  radius: number;
  km_multiplier: number;
  session_hours: number;
  is_open: boolean;
  moved_at: string;
};
type Item = { id: string; name: string; description: string | null; price: number; stock: number | null; is_active: boolean };
type Sale = { item: string; quantity: number; total: number; at: string; buyer: string };
type AdminData = { config: Config; items: Item[]; sales: Sale[]; finders: number; inside: number };

const emptyItem = { id: null as string | null, name: '', description: '', price: '', stock: '', is_active: true };

/** Tenir L'Envers : l'endroit de la faille, ses réglages et le Comptoir (admins de la carte). */
export default function EnversAdmin({ onPickSpot, onChanged }: { onPickSpot: () => void; onChanged: () => void }) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [cfg, setCfg] = useState({ radius: '', km_multiplier: '', session_hours: '' });
  const [form, setForm] = useState(emptyItem);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: d } = await supabase.rpc('envers_admin_get');
    if (!d || (d as { error?: string }).error) return;
    const a = d as AdminData;
    setData(a);
    setCfg({ radius: String(a.config.radius), km_multiplier: String(a.config.km_multiplier), session_hours: String(a.config.session_hours) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  async function rpc(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true);
    const { data: d, error } = await supabase.rpc(fn, args);
    setBusy(false);
    const err = (d as { error?: string } | null)?.error;
    if (error || err) {
      showToast(err === 'invalid_price' ? 'Prix invalide.' : err === 'invalid_name' ? 'Il faut un nom.' : 'Ça n’a pas marché.', 'error');
      return false;
    }
    showToast(ok, 'success');
    await load();
    onChanged();
    return true;
  }

  if (!data) return null;
  const c = data.config;

  return (
    <section className="envers-card envers-admin mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="envers-h2">Tenir L’Envers</h2>
        <span className="text-xs text-[#9aa6c4]">
          {data.finders > 1 ? `${data.finders} membres l’ont trouvé` : data.finders === 1 ? 'Un membre l’a trouvé' : 'Personne ne l’a encore trouvé'} · {data.inside} sur le chemin en ce moment
        </span>
      </div>

      {/* --------------------------------------------- La faille */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-display text-xs text-[#9aa6c4]">La faille</p>
          <p className="mt-1 text-sm text-[#c9d1e2]">
            x <strong className="text-[#efe4c8]">{Number(c.x).toFixed(2)}</strong> · y <strong className="text-[#efe4c8]">{Number(c.y).toFixed(2)}</strong>
            <span className="text-[#9aa6c4]"> · déplacée le {new Date(c.moved_at).toLocaleDateString('fr-FR')}</span>
          </p>
          <p className="mt-1 text-xs text-[#9aa6c4]">
            Cinq clics de suite à moins de {Number(c.radius)} unité{Number(c.radius) > 1 ? 's' : ''} de ce point déchirent la carte.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={onPickSpot} className="envers-btn-ghost !text-xs">
              <SidIcon name="pin" size={13} /> Choisir sur la carte
            </button>
            <button
              disabled={busy}
              onClick={() => confirm('Déplacer la faille au hasard ? Ceux qui la connaissent devront la retrouver.') && rpc('envers_admin_set_config', { p_random: true }, 'La faille a changé de place.')}
              className="envers-btn-ghost !text-xs"
            >
              <SidIcon name="dice" size={13} /> Au hasard
            </button>
            <button
              disabled={busy}
              onClick={() => rpc('envers_admin_set_config', { p_is_open: !c.is_open }, c.is_open ? 'L’Envers est fermé.' : 'L’Envers est rouvert.')}
              className="envers-btn-ghost !text-xs"
            >
              {c.is_open ? 'Fermer L’Envers' : 'Rouvrir L’Envers'}
            </button>
          </div>
          {!c.is_open && <p className="mt-2 text-xs text-[#e8b98a]">Fermé : plus personne ne peut déchirer la carte (les admins gardent l’accès).</p>}
        </div>

        <form
          className="grid grid-cols-3 content-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            rpc(
              'envers_admin_set_config',
              { p_radius: Number(cfg.radius), p_km_multiplier: Number(cfg.km_multiplier), p_session_hours: Number(cfg.session_hours) },
              'Réglages enregistrés.'
            );
          }}
        >
          <label className="text-[11px] text-[#9aa6c4]">
            Tolérance (unités)
            <input className="envers-input mt-1 w-full" inputMode="decimal" value={cfg.radius} onChange={(e) => setCfg({ ...cfg, radius: e.target.value })} />
          </label>
          <label className="text-[11px] text-[#9aa6c4]">
            × allure
            <input className="envers-input mt-1 w-full" inputMode="decimal" value={cfg.km_multiplier} onChange={(e) => setCfg({ ...cfg, km_multiplier: e.target.value })} />
          </label>
          <label className="text-[11px] text-[#9aa6c4]">
            Séjour (h)
            <input className="envers-input mt-1 w-full" inputMode="decimal" value={cfg.session_hours} onChange={(e) => setCfg({ ...cfg, session_hours: e.target.value })} />
          </label>
          <button disabled={busy} className="envers-btn-ghost col-span-3 !text-xs">
            Enregistrer les réglages
          </button>
        </form>
      </div>

      {/* --------------------------------------------- Le Comptoir */}
      <div className="mt-6 border-t border-[#c9d3e6]/10 pt-4">
        <p className="font-display text-xs text-[#9aa6c4]">Les étagères du Comptoir</p>
        <ul className="mt-2 divide-y divide-[#c9d3e6]/10">
          {data.items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className={`min-w-0 flex-1 ${it.is_active ? 'text-[#efe4c8]' : 'text-[#7d88a6] line-through'}`}>{it.name}</span>
              <span className="text-[#e7c873]">{Number(it.price).toLocaleString('fr-FR')}</span>
              <span className="w-20 text-right text-xs text-[#9aa6c4]">{it.stock === null ? 'illimité' : `${it.stock} en stock`}</span>
              <button
                onClick={() =>
                  setForm({
                    id: it.id,
                    name: it.name,
                    description: it.description ?? '',
                    price: String(it.price),
                    stock: it.stock === null ? '' : String(it.stock),
                    is_active: it.is_active
                  })
                }
                className="text-xs text-[#c9d3e6] underline-offset-2 hover:underline"
              >
                Modifier
              </button>
              <button
                onClick={() => confirm(`Retirer « ${it.name} » ?`) && rpc('envers_admin_delete_item', { p_id: it.id }, 'Article retiré.')}
                className="text-xs text-[#e8a08a] underline-offset-2 hover:underline"
              >
                Retirer
              </button>
            </li>
          ))}
          {data.items.length === 0 && <li className="py-2 text-sm text-[#9aa6c4]">Rien pour l’instant.</li>}
        </ul>

        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_7rem_6rem]"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await rpc(
              'envers_admin_save_item',
              {
                p_id: form.id,
                p_name: form.name,
                p_description: form.description,
                p_price: Number(form.price),
                p_stock: form.stock.trim() === '' ? null : Math.max(0, Math.floor(Number(form.stock))),
                p_is_active: form.is_active
              },
              form.id ? 'Article modifié.' : 'Article posé sur l’étagère.'
            );
            if (ok) setForm(emptyItem);
          }}
        >
          <input className="envers-input" placeholder="Nom de l’article" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="envers-input" placeholder="Prix" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input className="envers-input" placeholder="Stock (∞)" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <textarea
            className="envers-input sm:col-span-3"
            rows={2}
            placeholder="Description (facultatif)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <label className="flex items-center gap-2 text-xs text-[#c9d1e2]">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> En vente
            </label>
            <button disabled={busy} className="envers-btn !py-1.5">
              {form.id ? 'Enregistrer' : 'Ajouter'}
            </button>
            {form.id && (
              <button type="button" onClick={() => setForm(emptyItem)} className="text-xs text-[#9aa6c4] hover:underline">
                Annuler
              </button>
            )}
            <span className="text-[11px] text-[#7d88a6]">L’argent des ventes est partagé entre les admins (l’acheteur exclu).</span>
          </div>
        </form>
      </div>

      {data.sales.length > 0 && (
        <div className="mt-6 border-t border-[#c9d3e6]/10 pt-4">
          <p className="font-display text-xs text-[#9aa6c4]">Dernières ventes</p>
          <ul className="mt-2 space-y-1 text-[13px] text-[#c9d1e2]">
            {data.sales.map((s, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {s.buyer} · {s.item}
                  {s.quantity > 1 ? ` ×${s.quantity}` : ''}
                </span>
                <span className="shrink-0 text-[#9aa6c4]">
                  {Number(s.total).toLocaleString('fr-FR')} · {new Date(s.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
