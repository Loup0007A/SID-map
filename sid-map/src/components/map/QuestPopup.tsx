'use client';

import type { MapQuest } from '@/lib/types';

// Panneau HTML à taille fixe (indépendant du zoom de la carte).
export default function QuestPopup({ quest, onClose }: { quest: MapQuest; onClose: () => void }) {
  return (
    <div className="glass-strong absolute bottom-20 left-3 z-30 w-64 max-w-[calc(100%-1.5rem)] rounded-xl p-3 text-xs text-paper md:bottom-6 md:w-60">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-[#e7c34a]">📜 {quest.title}</p>
        <button onClick={onClose} className="text-paper/50 hover:text-accent">
          ✕
        </button>
      </div>
      {quest.contract_type && <p className="mt-1 text-paper/70">Contrat : {quest.contract_type}</p>}
      {quest.reward && <p className="text-paper/70">Récompense : {quest.reward}</p>}
      <a
        href="https://sid-quest.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-[#e7c34a] underline"
      >
        Voir sur le site principal →
      </a>
    </div>
  );
}
