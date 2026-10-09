'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDistance, niceDistance, type MapSettings } from '@/lib/mapScale';

// Échelle graphique : sa longueur suit le zoom. Les admins cliquent
// dessus pour régler l'échelle (1 unité de carte = X km) et la marche.
export default function ScaleBar({
  svgRef,
  viewBoxW,
  settings,
  canEdit,
  onSave
}: {
  svgRef: React.RefObject<SVGSVGElement>;
  viewBoxW: number;
  settings: MapSettings;
  canEdit: boolean;
  onSave: (s: MapSettings) => Promise<{ error: string | null }>;
}) {
  const { showToast } = useToast();
  const [pxWidth, setPxWidth] = useState(0);
  const [open, setOpen] = useState(false);
  const [km, setKm] = useState(String(settings.km_per_unit));
  const [walk, setWalk] = useState(String(settings.walk_kmh));

  useEffect(() => {
    const h = () => {
      if (!canEdit) return;
      setKm(String(settings.km_per_unit));
      setWalk(String(settings.walk_kmh));
      setOpen(true);
    };
    window.addEventListener('sid-scale-open', h);
    return () => window.removeEventListener('sid-scale-open', h);
  }, [canEdit, settings.km_per_unit, settings.walk_kmh]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => setPxWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [svgRef]);

  // kilomètres représentés par 1 px d'écran (le viewBox est « meet » : on
  // prend le plus petit côté, mais l'approximation par la largeur reste
  // juste pour une carte carrée centrée).
  const svg = svgRef.current;
  const rect = svg?.getBoundingClientRect();
  const minSide = rect ? Math.min(rect.width, rect.height) : pxWidth;
  const kmPerPx = minSide > 0 ? (viewBoxW * settings.km_per_unit) / minSide : 0;
  const targetPx = 110;
  const nice = kmPerPx > 0 ? niceDistance(kmPerPx * targetPx) : 0;
  const barPx = kmPerPx > 0 ? nice / kmPerPx : 0;

  async function save() {
    const k = Number(km.replace(',', '.'));
    const w = Number(walk.replace(',', '.'));
    if (!(k > 0) || !(w > 0)) return showToast('Valeurs invalides.', 'error');
    const { error } = await onSave({ ...settings, km_per_unit: k, walk_kmh: w });
    if (error) showToast("Impossible d'enregistrer l'échelle.", 'error');
    else {
      showToast('Échelle mise à jour.');
      setOpen(false);
    }
  }

  if (!barPx) return null;

  return (
    <>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => {
          setKm(String(settings.km_per_unit));
          setWalk(String(settings.walk_kmh));
          setOpen(true);
        }}
        title={canEdit ? "Régler l'échelle" : 'Échelle de la carte'}
        className="glass absolute bottom-3 left-3 z-10 rounded-lg px-2.5 py-1.5 text-left disabled:cursor-default md:bottom-4"
      >
        <div className="flex items-end" style={{ width: barPx }}>
          <div className="h-2 w-full border-x border-b border-paper/70" />
        </div>
        <p className="mt-0.5 font-display text-[10px] uppercase tracking-wide text-paper/70">
          {formatDistance(nice, settings.unit_label)}
          {canEdit && <span className="ml-1 text-accent">✎</span>}
        </p>
      </button>

      {open && (
        <Modal title="Échelle de la carte" onClose={() => setOpen(false)} maxWidth="max-w-xs"
          footer={
            <button onClick={save} className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper">
              Enregistrer
            </button>
          }
        >
          <div className="space-y-3">
            <label className="block space-y-1 text-[11px] uppercase tracking-wide text-paper/50">
              1 unité de carte = … {settings.unit_label}
              <input
                value={km}
                onChange={(e) => setKm(e.target.value)}
                inputMode="decimal"
                className="w-full glass-input rounded-lg px-3 py-2 text-sm normal-case outline-none"
              />
            </label>
            <p className="text-[10px] text-paper/40">
              La carte entière fait 100 unités de large : avec {km || '?'} {settings.unit_label}/unité, elle mesure{' '}
              {Math.round((Number(km.replace(',', '.')) || 0) * 100)} {settings.unit_label}.
            </p>
            <label className="block space-y-1 text-[11px] uppercase tracking-wide text-paper/50">
              Vitesse de marche ({settings.unit_label}/h)
              <input
                value={walk}
                onChange={(e) => setWalk(e.target.value)}
                inputMode="decimal"
                className="w-full glass-input rounded-lg px-3 py-2 text-sm normal-case outline-none"
              />
            </label>
            <p className="text-[10px] text-paper/40">
              Les montures qui volent utilisent cette échelle : temps de vol = distance ÷ vitesse (vitesse propre à la monture, ou marche × multiplicateur).
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
