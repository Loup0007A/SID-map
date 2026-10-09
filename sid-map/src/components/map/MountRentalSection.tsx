'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { useMountTypes } from '@/lib/hooks/useMountTypes';
import MountsModal from './MountsModal';
import { useMapSettings } from '@/lib/hooks/useMapSettings';
import type { MountRental } from '@/lib/types';

export default function MountRentalSection({
  placeId,
  canEdit,
  activeMountId,
  onRent,
  onUnequip
}: {
  placeId: string;
  canEdit: boolean;
  activeMountId: string | null;
  onRent: (rentalId: string) => Promise<{ error: string | null; data?: any }>;
  onUnequip?: () => Promise<{ error: string | null }>;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const mounts = useMountTypes();
  const { settings } = useMapSettings();
  const [rentals, setRentals] = useState<MountRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRental, setShowAddRental] = useState(false);
  const [showNewMountType, setShowNewMountType] = useState(false);
  const [renting, setRenting] = useState<string | null>(null);

  const [selectedMountType, setSelectedMountType] = useState('');
  const [priceOverride, setPriceOverride] = useState('');


  async function loadRentals() {
    setLoading(true);
    const { data } = await supabase.from('mount_rentals').select('*').eq('place_id', placeId);
    setRentals((data as MountRental[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadRentals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  async function addRental() {
    if (!selectedMountType) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('mount_rentals').insert({
      place_id: placeId,
      mount_type_id: selectedMountType,
      price_override: priceOverride ? Number(priceOverride) : null,
      created_by: user?.id ?? null
    });
    if (error) showToast("Impossible d'ajouter ce point de location.", 'error');
    else {
      showToast('Point de location ajouté.');
      setShowAddRental(false);
      setPriceOverride('');
      loadRentals();
    }
  }

  async function deleteRental(id: string) {
    if (!confirm('Retirer cette monture de la location ici ?')) return;
    await supabase.from('mount_rentals').delete().eq('id', id);
    loadRentals();
  }

  function rentalHoursFor(rentalId: string) {
    const r = rentals.find((x) => x.id === rentalId);
    return mounts.byId(r?.mount_type_id ?? null)?.rental_hours ?? 24;
  }

  async function handleRent(rentalId: string) {
    setRenting(rentalId);
    const { error, data } = await onRent(rentalId);
    setRenting(null);
    if (error === 'insufficient_funds') showToast('Fonds insuffisants.', 'error');
    else if (error === 'not_at_location') showToast('Tu dois être sur place pour louer.', 'error');
    else if (error === 'currently_traveling') showToast('Tu es en voyage.', 'error');
    else if (error === 'already_equipped') showToast('Tu as déjà cette monture.', 'error');
    else if (error) showToast(`Location impossible (${error}).`, 'error');
    else showToast(`Monture louée pour ${data?.price ?? '?'} pièces (valable ${rentalHoursFor(rentalId)} h).`);
  }

  if (loading) return null;

  return (
    <>
    {showNewMountType && (
      <MountsModal settings={settings} myPosition={null} onClose={() => { setShowNewMountType(false); mounts.reload(); }} />
    )}
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      <p className="text-[11px] uppercase tracking-wide text-paper/50">🐴 Montures louables ici</p>

      {rentals.length === 0 && !canEdit && (
        <p className="text-xs text-paper/40">Aucune monture disponible ici.</p>
      )}

      {rentals.map((r) => {
        const type = mounts.byId(r.mount_type_id);
        if (!type) return null;
        const price = r.price_override ?? type.rental_price;
        const isActive = activeMountId === type.id;
        return (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
          >
            <span>
              {type.icon} {type.name}
              {type.can_fly && ' · vol'} · x{type.speed_multiplier} · {price} 🪙
            </span>
            <div className="flex items-center gap-1.5">
              {isActive ? (
                <>
                  <span className="text-xs text-accent">Équipée</span>
                  {onUnequip && (
                    <button
                      onClick={async () => {
                        const { error } = await onUnequip();
                        showToast(error ? 'Impossible de descendre.' : 'Monture rendue.', error ? 'error' : 'success');
                      }}
                      className="rounded-lg border border-white/15 px-2 py-1 text-xs text-paper/70 hover:text-accent"
                    >
                      Descendre
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleRent(r.id)}
                  disabled={renting === r.id}
                  className="btn-accent rounded-lg px-2.5 py-1 text-xs text-paper disabled:opacity-50"
                >
                  Louer
                </button>
              )}
              {canEdit && (
                <button onClick={() => deleteRental(r.id)} className="text-accent/70 hover:text-accent">
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })}

      {canEdit && (
        <div className="space-y-2">
          {showAddRental ? (
            <div className="space-y-1.5 rounded-lg border border-white/10 p-2">
              <select
                value={selectedMountType}
                onChange={(e) => setSelectedMountType(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full glass-input rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="">Choisir un type de monture…</option>
                {mounts.mountTypes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icon} {m.name} ({m.rental_price} 🪙)
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Prix ici (optionnel, sinon prix par défaut)"
                value={priceOverride}
                onChange={(e) => setPriceOverride(e.target.value)}
                className="w-full glass-input rounded-lg px-2 py-1.5 text-xs outline-none"
              />
              <div className="flex gap-1.5">
                <button onClick={addRental} className="btn-accent flex-1 rounded-lg py-1.5 text-xs text-paper">
                  Ajouter
                </button>
                <button
                  onClick={() => setShowAddRental(false)}
                  className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-paper/60"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddRental(true)}
              className="w-full rounded-lg border border-dashed border-accent/40 py-1.5 text-xs text-accent hover:bg-accent/10"
            >
              + Proposer une monture ici
            </button>
          )}

          <button
            onClick={() => setShowNewMountType(true)}
            className="w-full rounded-lg border border-dashed border-white/20 py-1.5 text-xs text-paper/60 hover:bg-white/5"
          >
            ⚙ Gérer les types de monture
          </button>
        </div>
      )}
    </div>
    </>
  );
}
