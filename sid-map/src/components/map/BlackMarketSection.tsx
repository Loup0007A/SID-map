'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import type { BlackMarketItem, BlackMarketStall } from '@/lib/types';

const ERRORS: Record<string, string> = {
  not_at_location: "Tu dois être sur place pour acheter.",
  currently_traveling: 'Tu es en voyage.',
  insufficient_funds: 'Fonds insuffisants.',
  out_of_stock: 'Rupture de stock.',
  own_stall: 'Tu ne peux pas acheter à ton propre étal.',
  stall_closed: 'Étal fermé.',
  item_not_found: 'Article introuvable.'
};

export default function BlackMarketSection({
  placeId,
  canEdit,
  allows,
  myUserId,
  isHere,
  onAllowChange,
  onReload
}: {
  placeId: string;
  canEdit: boolean;
  allows: boolean;
  myUserId: string | null;
  isHere: boolean;
  onAllowChange: (v: boolean) => void;
  onReload?: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [stalls, setStalls] = useState<BlackMarketStall[]>([]);
  const [items, setItems] = useState<BlackMarketItem[]>([]);
  const [busy, setBusy] = useState(false);

  const [stallName, setStallName] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemStock, setItemStock] = useState('');

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('black_market_stalls').select('*').eq('place_id', placeId);
    const list = (s as BlackMarketStall[]) ?? [];
    setStalls(list);
    if (list.length) {
      const { data: i } = await supabase
        .from('black_market_items')
        .select('*')
        .in('stall_id', list.map((x) => x.id))
        .order('created_at');
      setItems((i as BlackMarketItem[]) ?? []);
    } else setItems([]);
  }, [placeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (allows) load();
  }, [allows, load]);

  async function toggleAllow(v: boolean) {
    onAllowChange(v);
    await supabase.from('map_places').update({ allows_black_market: v }).eq('id', placeId);
    onReload?.();
  }

  if (!allows && !canEdit) return null;

  const myStall = stalls.find((s) => s.owner_id === myUserId);

  async function createStall() {
    if (!stallName.trim() || !myUserId) return;
    setBusy(true);
    const { error } = await supabase
      .from('black_market_stalls')
      .insert({ place_id: placeId, owner_id: myUserId, name: stallName.trim() });
    setBusy(false);
    if (error) showToast("Impossible d'ouvrir l'étal (sois présent sur place).", 'error');
    else {
      setStallName('');
      load();
    }
  }

  async function addItem() {
    if (!myStall || !itemName.trim() || !(Number(itemPrice) > 0)) return;
    setBusy(true);
    const { error } = await supabase.from('black_market_items').insert({
      stall_id: myStall.id,
      name: itemName.trim(),
      price: Number(itemPrice),
      stock: itemStock === '' ? null : Math.max(0, parseInt(itemStock, 10) || 0)
    });
    setBusy(false);
    if (error) showToast("Impossible d'ajouter l'article.", 'error');
    else {
      setItemName('');
      setItemPrice('');
      setItemStock('');
      load();
    }
  }

  async function removeItem(id: string) {
    await supabase.from('black_market_items').delete().eq('id', id);
    load();
  }

  async function closeStall(id: string) {
    if (!confirm("Fermer l'étal et supprimer ses articles ?")) return;
    await supabase.from('black_market_stalls').delete().eq('id', id);
    load();
  }

  async function buy(item: BlackMarketItem) {
    setBusy(true);
    const { data, error } = await supabase.rpc('buy_black_market_item', { p_item_id: item.id, p_quantity: 1 });
    setBusy(false);
    const err = error?.message ?? data?.error;
    if (err) showToast(ERRORS[err] ?? 'Achat impossible.', 'error');
    else {
      showToast(`Acheté : ${item.name} (${item.price} 💰)`);
      load();
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-wide text-paper/50">🕶️ Marché noir</p>

      {canEdit && (
        <label className="mt-2 flex items-center gap-2 text-xs text-paper/70">
          <input
            type="checkbox"
            checked={allows}
            onChange={(e) => toggleAllow(e.target.checked)}
            className="h-4 w-4 accent-[#b3261e]"
          />
          Autoriser les marchés noirs ici
        </label>
      )}

      {allows && (
        <>
          <p className="mt-2 text-[10px] text-paper/40">
            10 % de chaque vente sont reversés aux admins. Il faut être sur place pour acheter ou vendre.
          </p>

          {stalls.length === 0 && <p className="mt-2 text-xs text-paper/50">Aucun étal pour l'instant.</p>}

          <div className="mt-2 space-y-2">
            {stalls.map((s) => {
              const mine = s.owner_id === myUserId;
              const its = items.filter((i) => i.stall_id === s.id);
              return (
                <div key={s.id} className="rounded-lg bg-black/20 p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-paper">
                      {s.name} {mine && <span className="text-[10px] text-accent">(le tien)</span>}
                    </p>
                    {(mine || canEdit) && (
                      <button onClick={() => closeStall(s.id)} className="text-[10px] text-accent hover:underline">
                        Fermer
                      </button>
                    )}
                  </div>
                  {its.length === 0 && <p className="text-[11px] text-paper/40">Étal vide.</p>}
                  {its.map((i) => (
                    <div key={i.id} className="mt-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-paper/80">
                        {i.name}
                        <span className="text-paper/40">
                          {' '}
                          · {i.stock === null ? '∞' : `${i.stock} en stock`}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="text-accent">{i.price} 💰</span>
                        {mine || canEdit ? (
                          <button onClick={() => removeItem(i.id)} className="text-paper/40 hover:text-accent">
                            🗑
                          </button>
                        ) : (
                          <button
                            disabled={busy || !isHere || i.stock === 0}
                            onClick={() => buy(i)}
                            className="btn-accent rounded-md px-2 py-0.5 text-[11px] text-paper disabled:opacity-40"
                          >
                            Acheter
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                  {!isHere && !mine && <p className="mt-1 text-[10px] text-paper/40">Rends-toi sur place pour acheter.</p>}

                  {mine && (
                    <div className="mt-2 grid grid-cols-6 gap-1">
                      <input
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="Article"
                        className="glass-input col-span-6 rounded-md px-2 py-1 text-xs outline-none"
                      />
                      <input
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        placeholder="Prix"
                        inputMode="decimal"
                        className="glass-input col-span-2 rounded-md px-2 py-1 text-xs outline-none"
                      />
                      <input
                        value={itemStock}
                        onChange={(e) => setItemStock(e.target.value)}
                        placeholder="Stock (∞)"
                        inputMode="numeric"
                        className="glass-input col-span-2 rounded-md px-2 py-1 text-xs outline-none"
                      />
                      <button
                        onClick={addItem}
                        disabled={busy}
                        className="btn-accent col-span-2 rounded-md px-2 py-1 text-xs text-paper disabled:opacity-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!myStall && myUserId && isHere && (
            <div className="mt-2 flex gap-1.5">
              <input
                value={stallName}
                onChange={(e) => setStallName(e.target.value)}
                placeholder="Nom de ton étal…"
                maxLength={50}
                className="glass-input w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
              />
              <button
                onClick={createStall}
                disabled={busy}
                className="btn-accent shrink-0 rounded-lg px-3 py-1.5 text-xs text-paper disabled:opacity-50"
              >
                Ouvrir
              </button>
            </div>
          )}
          {!myStall && !isHere && (
            <p className="mt-2 text-[10px] text-paper/40">Sois présent sur place pour ouvrir un étal.</p>
          )}
        </>
      )}
    </div>
  );
}
