'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useNow } from '@/lib/hooks/useNow';
import { useMountTypes } from '@/lib/hooks/useMountTypes';
import { usePositions } from '@/lib/hooks/usePositions';
import { computeRemainingMinutes, formatMinutes } from '@/lib/travel';
import type { CityBuilding, MapPlace, MapRoute } from '@/lib/types';

export default function PositionPickerModal({
  places,
  routes,
  buildings,
  cityId,
  positionsHook,
  onClose
}: {
  places: MapPlace[];
  routes: MapRoute[];
  buildings?: CityBuilding[];
  cityId?: string;
  positionsHook: ReturnType<typeof usePositions>;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const now = useNow(1000);
  const mounts = useMountTypes();
  const { myPosition, setInitialPlace, startJourney, setCurrentBuilding, setStatus } = positionsHook;

  const [statusText, setStatusText] = useState(myPosition?.status ?? '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [flightQuery, setFlightQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const activeMount = mounts.byId(myPosition?.active_mount_id ?? null);
  const isTraveling = !!myPosition?.travel_started_at;

  async function saveStatus() {
    setSavingStatus(true);
    const { error } = await setStatus(statusText, myPosition?.is_visible ?? true);
    setSavingStatus(false);
    if (error) showToast('Impossible de mettre à jour le statut.', 'error');
    else showToast('Statut mis à jour.');
  }

  async function pickInitialPlace(placeId: string) {
    setBusy(true);
    const { error } = await setInitialPlace(placeId);
    setBusy(false);
    if (error) showToast("Impossible de s'établir ici.", 'error');
    else {
      showToast('Te voilà établi !');
      onClose();
    }
  }

  async function travelRoute(routeId: string) {
    setBusy(true);
    const { error } = await startJourney({ routeId });
    setBusy(false);
    if (error === 'already_traveling') showToast('Tu es déjà en voyage.', 'error');
    else if (error) showToast('Impossible de partir.', 'error');
    else showToast('En route !');
  }

  async function flyTo(placeId: string) {
    setBusy(true);
    const { error } = await startJourney({ targetPlaceId: placeId });
    setBusy(false);
    if (error) showToast('Vol impossible.', 'error');
    else showToast('Envol !');
  }

  // --- Cas 1 : voyage en cours ---
  if (isTraveling && myPosition) {
    const remaining = computeRemainingMinutes(myPosition, now);
    const total = myPosition.travel_duration_minutes ?? 1;
    const pct = Math.round(((total - remaining) / total) * 100);
    const destRoute = routes.find((r) => r.id === myPosition.route_id);
    const destPlace = myPosition.flight_target_place_id
      ? places.find((p) => p.id === myPosition.flight_target_place_id)
      : destRoute
      ? places.find(
          (p) =>
            p.id === (destRoute.from_place_id === myPosition.place_id ? destRoute.to_place_id : destRoute.from_place_id)
        )
      : null;

    return (
      <Modal title="En voyage…" onClose={onClose}>
        <div className="space-y-3 text-center">
          <p className="text-3xl">{myPosition.flight_target_place_id ? '🕊️' : activeMount ? activeMount.icon : '🚶'}</p>
          <p className="text-sm text-paper/80">
            En route vers <span className="text-accent">{destPlace?.name ?? '?'}</span>
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-paper/50">
            {remaining <= 0 ? 'Arrivée imminente…' : `Arrivée dans ${formatMinutes(remaining)}`}
          </p>
          <p className="text-[11px] text-paper/30">
            Impossible de faire autre chose en attendant — le voyage se termine automatiquement.
          </p>
        </div>
      </Modal>
    );
  }

  // --- Cas 2 : pas encore établi quelque part ---
  if (!myPosition?.place_id) {
    const results = placeQuery
      ? places.filter((p) => p.name.toLowerCase().includes(placeQuery.toLowerCase()))
      : places;

    return (
      <Modal title="Où commence ton personnage ?" onClose={onClose}>
        <div className="space-y-2">
          <p className="text-xs text-paper/50">
            Premier positionnement uniquement. Ensuite, tout déplacement se fera par un vrai trajet (à
            pied, en voyage ou en vol) — plus aucune téléportation.
          </p>
          <input
            value={placeQuery}
            onChange={(e) => setPlaceQuery(e.target.value)}
            placeholder="Rechercher un lieu…"
            className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
          />
          <div className="max-h-56 space-y-1 overflow-y-auto scrollbar-thin pr-1">
            {results.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={() => pickInitialPlace(p.id)}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-paper/80 hover:bg-white/10 disabled:opacity-50"
              >
                {p.icon ?? '📍'} {p.name}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  // --- Cas 3 : établi quelque part, libre de voyager ---
  const connectedRoutes = routes.filter(
    (r) => r.from_place_id === myPosition.place_id || r.to_place_id === myPosition.place_id
  );
  const currentPlace = places.find((p) => p.id === myPosition.place_id);
  const flightResults = flightQuery
    ? places.filter((p) => p.id !== myPosition.place_id && p.name.toLowerCase().includes(flightQuery.toLowerCase()))
    : [];

  return (
    <Modal title="Ma position" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm">
          <p className="text-paper/50 text-[10px] uppercase tracking-wide">Actuellement</p>
          <p className="text-paper">
            {currentPlace?.icon ?? '📍'} {currentPlace?.name ?? '?'}
            {activeMount && (
              <span className="ml-2 text-accent">
                {activeMount.icon} {activeMount.name}
              </span>
            )}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wide text-paper/50">
            Statut libre (indépendant du lieu)
          </label>
          <div className="flex gap-2">
            <input
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="ex : disponible pour du RP, en train de dormir…"
              maxLength={80}
              className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={saveStatus}
              disabled={savingStatus}
              className="btn-accent shrink-0 rounded-lg px-3 py-2 text-xs text-paper disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </div>

        {buildings && buildings.length > 0 && cityId === myPosition.place_id && (
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-paper/50">Bâtiment (dans cette ville)</label>
            <select
              value={myPosition.building_id ?? ''}
              onChange={(e) => setCurrentBuilding(e.target.value || null)}
              style={{ colorScheme: 'dark' }}
              className="w-full glass-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Quelque part en ville</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.type}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="border-t border-white/10 pt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-paper/50">
            🛣 Voyager (à pied{activeMount ? ` / ${activeMount.name}` : ''})
          </p>
          {connectedRoutes.length === 0 && (
            <p className="text-xs text-paper/40">Aucune route ne part d'ici pour l'instant.</p>
          )}
          <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin pr-1">
            {connectedRoutes.map((r) => {
              const destId = r.from_place_id === myPosition.place_id ? r.to_place_id : r.from_place_id;
              const dest = places.find((p) => p.id === destId);
              const baseMinutes = r.travel_minutes ?? 30;
              const duration = baseMinutes / (activeMount?.speed_multiplier ?? 1);
              return (
                <button
                  key={r.id}
                  disabled={busy}
                  onClick={() => travelRoute(r.id)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-paper/80 hover:bg-white/10 disabled:opacity-50"
                >
                  <span>
                    {dest?.icon ?? '📍'} {dest?.name ?? '?'}
                  </span>
                  <span className="text-xs text-accent">{formatMinutes(duration)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeMount?.can_fly && (
          <div className="border-t border-white/10 pt-3">
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-paper/50">🕊️ Voler directement</p>
            <input
              value={flightQuery}
              onChange={(e) => setFlightQuery(e.target.value)}
              placeholder="Rechercher une destination…"
              className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
            />
            {flightResults.length > 0 && (
              <div className="mt-1 max-h-32 space-y-1 overflow-y-auto scrollbar-thin pr-1">
                {flightResults.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    disabled={busy}
                    onClick={() => flyTo(p.id)}
                    className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-paper/80 hover:bg-white/10 disabled:opacity-50"
                  >
                    {p.icon ?? '📍'} {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
