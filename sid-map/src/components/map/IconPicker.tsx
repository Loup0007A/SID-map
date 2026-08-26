'use client';

import { ICON_CATALOG } from '@/lib/icons';

export default function IconPicker({
  value,
  onChange
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wide text-paper/50">Icône</label>
      <div className="grid grid-cols-9 gap-1 rounded-lg border border-white/10 bg-white/5 p-2">
        {ICON_CATALOG.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => onChange(icon)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition ${
              value === icon ? 'bg-accent/30 ring-1 ring-accent' : 'hover:bg-white/10'
            }`}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
