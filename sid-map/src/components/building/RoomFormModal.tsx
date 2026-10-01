'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

const ROOM_TYPES = ['Chambre', 'Salon', 'Cuisine', 'Salle', 'Couloir', 'Escalier', 'Autel', 'Cave', 'Autre'];

export default function RoomFormModal({
  onClose,
  onSave,
  currentFloorNumber
}: {
  onClose: () => void;
  onSave: (name: string, type: string, connectsToFloor?: number) => void;
  currentFloorNumber?: number;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState(ROOM_TYPES[0]);
  const [connectsTo, setConnectsTo] = useState(
    currentFloorNumber != null ? String(currentFloorNumber + 1) : ''
  );

  return (
    <Modal title="Nommer la pièce" onClose={onClose}>
      <div className="space-y-3">
        <input
          placeholder="Nom (ex: Chambre principale)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none transition"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
        >
          {ROOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {type === 'Escalier' && (
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-paper/50">
              Mène à l'étage n° (0 = rez-de-chaussée, négatif = sous-sol)
            </label>
            <input
              type="number"
              value={connectsTo}
              onChange={(e) => setConnectsTo(e.target.value)}
              className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
        )}
        <button
          onClick={() =>
            onSave(name.trim() || type, type, type === 'Escalier' && connectsTo !== '' ? Number(connectsTo) : undefined)
          }
          className="w-full btn-accent rounded-lg py-2.5 text-sm font-semibold text-paper transition"
        >
          Ajouter la pièce
        </button>
      </div>
    </Modal>
  );
}
