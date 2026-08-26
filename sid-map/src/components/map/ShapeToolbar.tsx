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
          className={`rounded-lg border px-2.5 py-1.5 font-display text-xs transition ${
            active === t.value
              ? 'btn-accent border-transparent text-paper'
              : 'border-white/15 bg-white/5 text-paper/70 hover:border-accent/60 hover:bg-white/10'
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
          className="rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 font-display text-xs text-paper/80 disabled:opacity-30"
        >
          Terminer ({pointsCount})
        </button>
      )}

      {active && (
        <button
          onClick={onCancel}
          className="rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1.5 font-display text-xs text-accent"
        >
          Annuler
        </button>
      )}
    </div>
  );
}
