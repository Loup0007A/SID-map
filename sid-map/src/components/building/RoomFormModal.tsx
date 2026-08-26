'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';

const ROOM_TYPES = ['Chambre', 'Salon', 'Cuisine', 'Salle', 'Couloir', 'Escalier', 'Autel', 'Cave', 'Autre'];

export default function RoomFormModal({
  onClose,
  onSave
}: {
  onClose: () => void;
  onSave: (name: string, type: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState(ROOM_TYPES[0]);

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
          className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
        >
          {ROOM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={() => onSave(name.trim() || type, type)}
          className="w-full btn-accent rounded-lg py-2.5 text-sm font-semibold text-paper transition"
        >
          Ajouter la pièce
        </button>
      </div>
    </Modal>
  );
}
