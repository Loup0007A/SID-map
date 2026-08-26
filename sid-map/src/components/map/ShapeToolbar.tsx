'use client';

import type { ShapeTool } from '@/lib/drawTools';
import { SHAPE_TOOLS } from '@/lib/drawTools';

export default function ShapeToolbar({
  active,
  onSelect,
  pointsCount,
  onFinish,
  onCancel,
  canFinish
}: {
  active: ShapeTool | null;
  onSelect: (t: ShapeTool) => void;
  pointsCount: number;
  onFinish: () => void;
  onCancel: () => void;
  canFinish: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SHAPE_TOOLS.map((t) => (
        <button
          key={t.value}
          onClick={() => onSelect(t.value)}
          title={t.label}
          className={`border px-2 py-1.5 font-display text-xs ${
            active === t.value
              ? 'border-accent bg-accent text-paper'
              : 'border-white/15 text-paper/70 hover:border-accent/60'
          }`}
        >
          <span className="mr-1">{t.icon}</span>
          {t.label}
        </button>
      ))}

      {active === 'polygon' && (
        <button
          onClick={onFinish}
          disabled={!canFinish}
          className="border border-white/20 px-2 py-1.5 font-display text-xs text-paper/80 disabled:opacity-30"
        >
          Terminer ({pointsCount})
        </button>
      )}

      {active && (
        <button
          onClick={onCancel}
          className="border border-accent/50 px-2 py-1.5 font-display text-xs text-accent"
        >
          Annuler
        </button>
      )}
    </div>
  );
}
