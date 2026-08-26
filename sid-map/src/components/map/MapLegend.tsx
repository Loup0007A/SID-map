'use client';

import { useState } from 'react';

export interface LegendSection {
  title: string;
  items: { icon?: string; color?: string; label: string }[];
}

export default function MapLegend({ sections }: { sections: LegendSection[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-3 right-4 z-20">
      {open && (
        <div className="glass-strong mb-2 max-h-[60vh] w-56 space-y-3 overflow-y-auto scrollbar-thin rounded-2xl p-3">
          {sections.map((s) => (
            <div key={s.title}>
              <p className="mb-1 font-display text-[10px] uppercase tracking-wide text-accent">{s.title}</p>
              <div className="space-y-1">
                {s.items.map((it) => (
                  <div key={it.label} className="flex items-center gap-2 text-xs text-paper/80">
                    {it.icon && <span className="w-4 text-center">{it.icon}</span>}
                    {it.color && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
                        style={{ backgroundColor: it.color }}
                      />
                    )}
                    <span className="truncate">{it.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[10px] uppercase tracking-wide text-paper/70 hover:text-accent"
      >
        ℹ Légende
      </button>
    </div>
  );
}
