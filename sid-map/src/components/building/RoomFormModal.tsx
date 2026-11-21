'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { BuildingFloor } from '@/lib/types';
import { ROOM_TYPES, floorLabel, roomType } from '@/lib/rooms';

/** Nouvelle pièce (Lot 92) : nom, type (sol et mobilier), étage relié pour un escalier. */
export default function RoomFormModal({
  onClose,
  onSave,
  currentFloorNumber,
  floors = [],
}: {
  onClose: () => void;
  onSave: (name: string, type: string, connectsToFloor?: number) => void;
  currentFloorNumber?: number;
  floors?: BuildingFloor[];
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState(ROOM_TYPES[0].key);
  const others = floors.filter((f) => f.floor_number !== currentFloorNumber);
  const [connectsTo, setConnectsTo] = useState(
    others.length ? String(others.find((f) => f.floor_number === (currentFloorNumber ?? 0) + 1)?.floor_number ?? others[0].floor_number) : ''
  );

  return (
    <Modal title="Nouvelle pièce" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name.trim().slice(0, 60) || type, type, type === 'Escalier' && connectsTo !== '' ? Number(connectsTo) : undefined);
        }}
      >
        <label className="block text-sm">
          Nom
          <input
            autoFocus
            placeholder={`Ex. ${type === 'Chambre' ? 'Chambre du capitaine' : type}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
          />
        </label>
        <fieldset>
          <legend className="text-sm">Type</legend>
          <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {ROOM_TYPES.map((t) => (
              <button
                type="button"
                key={t.key}
                aria-pressed={type === t.key}
                onClick={() => setType(t.key)}
                className={`room-type ${type === t.key ? 'is-on' : ''}`}
              >
                <span className="room-swatch is-small" style={{ background: roomType(t.key).tint }} aria-hidden />
                {t.key}
              </button>
            ))}
          </div>
        </fieldset>
        {type === 'Escalier' && (
          <label className="block text-sm">
            Mène à
            {others.length ? (
              <select value={connectsTo} onChange={(e) => setConnectsTo(e.target.value)} className="glass-input mt-1 block w-full rounded-lg px-3 py-2 text-sm">
                {others.map((f) => (
                  <option key={f.id} value={f.floor_number}>
                    {floorLabel(f.floor_number, f.name)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="mt-1 block text-xs opacity-75">Ajoute un autre étage pour relier cet escalier.</span>
            )}
          </label>
        )}
        <button type="submit" className="btn-accent w-full rounded-lg py-2.5 text-sm">
          Ajouter la pièce
        </button>
      </form>
    </Modal>
  );
}
