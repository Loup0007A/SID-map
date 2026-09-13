'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { CityBuilding, MapPlace, MapRoute } from '@/lib/types';

type Mode = 'place' | 'route' | 'note';

export default function PositionPickerModal({
  places,
  routes,
  buildings,
  cityId,
  currentPosition,
  onClose,
  onSave,
  onClear
}: {
  places: MapPlace[];
  routes?: MapRoute[];
  buildings?: CityBuilding[];
  cityId?: string;
  currentPosition?: {
    place_id: string | null;
    building_id: string | null;
    route_id: string | null;
    route_progress: number | null;
    note: string | null;
    is_visible: boolean;
  } | null;
  onClose: () => void;
  onSave: (update: {
    place_id?: string | null;
    building_id?: string | null;
    route_id?: string | null;
    route_progress?: number | null;
    note?: string | null;
    is_visible?: boolean;
  }) => Promise<{ error: string | null }>;
  onClear: () => void;
}) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>(
    currentPosition?.route_id ? 'route' : currentPosition?.note ? 'note' : 'place'
  );
  const [query, setQuery] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(currentPosition?.place_id ?? cityId ?? null);
  const [buildingId, setBuildingId] = useState<string | null>(currentPosition?.building_id ?? null);
  const [routeId, setRouteId] = useState<string | null>(currentPosition?.route_id ?? null);
  const [progress, setProgress] = useState<number>(
    currentPosition?.route_progress != null ? Math.round(currentPosition.route_progress * 100) : 50
  );
  const [note, setNote] = useState(currentPosition?.note ?? '');
  const [visible, setVisible] = useState(currentPosition?.is_visible ?? true);
  const [saving, setSaving] = useState(false);

  const filteredPlaces = query
    ? places.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : places;

  async function save() {
    setSaving(true);
    let update: Parameters<typeof onSave>[0] = { is_visible: visible };

    if (mode === 'place') {
      if (!placeId) {
        showToast('Choisis un lieu.', 'error');
        setSaving(false);
        return;
      }
      update = { ...update, place_id: placeId, building_id: buildingId, route_id: null, route_progress: null, note: null };
    } else if (mode === 'route') {
      if (!routeId) {
        showToast('Choisis une route.', 'error');
        setSaving(false);
        return;
      }
      update = { ...update, route_id: routeId, route_progress: progress / 100, place_id: null, building_id: null, note: null };
    } else {
      if (!note.trim()) {
        showToast('Écris une courte note.', 'error');
        setSaving(false);
        return;
      }
      update = { ...update, note: note.trim(), place_id: null, building_id: null, route_id: null, route_progress: null };
    }

    const { error } = await onSave(update);
    setSaving(false);
    if (error) showToast("Impossible d'enregistrer ta position.", 'error');
    else {
      showToast('Position mise à jour.');
      onClose();
    }
  }

  return (
    <Modal title="Ma position" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-1.5">
          {(['place', 'route', 'note'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition ${
                mode === m ? 'btn-accent text-paper' : 'border border-white/15 bg-white/5 text-paper/70'
              }`}
            >
              {m === 'place' ? '📍 Un lieu' : m === 'route' ? '🛣 En voyage' : '✎ Note libre'}
            </button>
          ))}
        </div>

        {mode === 'place' && (
          <div className="space-y-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un lieu…"
              className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
            />
            <div className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin pr-1">
              {filteredPlaces.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPlaceId(p.id);
                    setBuildingId(null);
                  }}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                    placeId === p.id ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-paper/80'
                  }`}
                >
                  {p.icon ?? '📍'} {p.name}
                </button>
              ))}
              {filteredPlaces.length === 0 && <p className="text-xs text-paper/40">Aucun résultat.</p>}
            </div>

            {buildings && buildings.length > 0 && placeId === cityId && (
              <div className="border-t border-white/10 pt-2">
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-paper/50">
                  Précision (optionnel) : dans quel bâtiment ?
                </label>
                <select
                  value={buildingId ?? ''}
                  onChange={(e) => setBuildingId(e.target.value || null)}
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
          </div>
        )}

        {mode === 'route' && (
          <div className="space-y-2">
            {(!routes || routes.length === 0) && (
              <p className="text-xs text-paper/50">Aucune route n'a encore été tracée sur la carte.</p>
            )}
            <div className="max-h-32 space-y-1 overflow-y-auto scrollbar-thin pr-1">
              {routes?.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRouteId(r.id)}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                    routeId === r.id ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-paper/80'
                  }`}
                >
                  🛣 {r.name || 'Route sans nom'}
                </button>
              ))}
            </div>
            {routeId && (
              <div className="space-y-1">
                <label className="flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50">
                  <span>Avancement du trajet</span>
                  <span className="text-accent">{progress}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full accent-[#b3261e]"
                />
              </div>
            )}
          </div>
        )}

        {mode === 'note' && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex : Quelque part dans les Terres Perdues…"
            maxLength={80}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
          />
        )}

        <label className="flex items-center gap-2 text-sm text-paper/70">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="h-4 w-4 accent-[#b3261e]"
          />
          Visible par les autres membres
        </label>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="btn-accent flex-1 rounded-lg py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer ma position'}
          </button>
          {currentPosition && (
            <button
              onClick={() => {
                onClear();
                onClose();
              }}
              className="rounded-lg border border-white/15 px-3 py-2.5 text-sm text-paper/60 hover:border-accent hover:text-accent"
            >
              Effacer
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
