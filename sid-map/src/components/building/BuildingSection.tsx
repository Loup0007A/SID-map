'use client';

import type { BuildingFloor } from '@/lib/types';
import { floorLabel } from '@/lib/rooms';

/**
 * Coupe du bâtiment (Lot 92) : le toit, les étages empilés au-dessus du
 * sol, les sous-sols dans la terre. Chaque étage s'ouvre d'un clic.
 */
export default function BuildingSection({
  floors,
  active,
  onPick,
  canEdit,
  onAdd,
}: {
  floors: BuildingFloor[];
  active: number | null;
  onPick: (n: number) => void;
  canEdit: boolean;
  onAdd: (dir: 'up' | 'down') => void;
}) {
  const above = floors.filter((f) => f.floor_number >= 0).sort((a, b) => b.floor_number - a.floor_number);
  const below = floors.filter((f) => f.floor_number < 0).sort((a, b) => b.floor_number - a.floor_number);
  const Band = ({ f }: { f: BuildingFloor }) => (
    <button
      onClick={() => onPick(f.floor_number)}
      aria-current={active === f.floor_number ? 'true' : undefined}
      className={`section-floor ${f.floor_number < 0 ? 'is-under' : ''} ${active === f.floor_number ? 'is-on' : ''}`}
    >
      <span className="line-clamp-2 min-w-0">{floorLabel(f.floor_number, f.name)}</span>
      <span className="section-count">{(f.plan_data ?? []).length}</span>
    </button>
  );
  return (
    <nav aria-label="Étages" className="building-section">
      {canEdit && (
        <button onClick={() => onAdd('up')} className="section-add">
          + Étage
        </button>
      )}
      <div className="section-roof" aria-hidden />
      <div className="section-walls">
        {above.map((f) => (
          <Band key={f.id} f={f} />
        ))}
        {above.length === 0 && <p className="px-2 py-3 text-center text-xs opacity-70">Aucun étage</p>}
      </div>
      <div className="section-ground" aria-hidden />
      {(below.length > 0 || canEdit) && (
        <div className="section-earth">
          {below.map((f) => (
            <Band key={f.id} f={f} />
          ))}
          {canEdit && (
            <button onClick={() => onAdd('down')} className="section-add is-under">
              + Sous-sol
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
