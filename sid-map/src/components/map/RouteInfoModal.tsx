'use client';

import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { usePermission } from '@/lib/hooks/usePermission';
import type { MapPlace, MapRoute } from '@/lib/types';

export default function RouteInfoModal({
  route,
  places,
  onClose,
  onDeleted
}: {
  route: MapRoute;
  places: MapPlace[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const { allowed: canEdit } = usePermission('manage_map');
  const from = places.find((p) => p.id === route.from_place_id);
  const to = places.find((p) => p.id === route.to_place_id);

  async function handleDelete() {
    if (!confirm(`Supprimer la route "${route.name || 'sans nom'}" ?`)) return;
    const { error } = await supabase.from('map_routes').delete().eq('id', route.id);
    if (error) showToast('Suppression impossible.', 'error');
    else {
      showToast('Route supprimée.');
      onClose();
      onDeleted();
    }
  }

  return (
    <Modal title={route.name || 'Route'} onClose={onClose}>
      <div className="space-y-2 text-sm text-paper/80">
        <p>
          🛣 {from?.name ?? '?'} → {to?.name ?? '?'}
        </p>
        {route.travel_minutes && <p className="text-paper/60">Temps de trajet RP : {route.travel_minutes} min</p>}
        {canEdit && (
          <button
            onClick={handleDelete}
            className="mt-3 w-full rounded-lg border border-accent/40 py-2 text-xs text-accent hover:bg-accent/10"
          >
            🗑 Supprimer cette route
          </button>
        )}
      </div>
    </Modal>
  );
}
