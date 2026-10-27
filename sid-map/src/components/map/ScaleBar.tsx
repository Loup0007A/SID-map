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
  onSave,
  minWorld = 100
}: {
  /** plus petite taille possible sans laisser d'élément hors carte */
  minWorld?: number;
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
  const [world, setWorld] = useState(String(settings.world_size));

  useEffect(() => {
    const h = () => {
      if (!canEdit) return;
      setKm(String(settings.km_per_unit));
      setWalk(String(settings.walk_kmh));
      setWorld(String(settings.world_size));
      setOpen(true);
    };
    window.addEventListener('sid-scale-open', h);
    return () => window.removeEventListener('sid-scale-open', h);
  }, [canEdit, settings.km_per_unit, settings.walk_kmh, settings.world_size]);

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
    const size = Math.round(Number(world.replace(',', '.')));
    if (!(k > 0) || !(w > 0)) return showToast('Valeurs invalides.', 'error');
    if (!(size >= 100) || size > 1000) return showToast('La taille de la carte doit être comprise entre 100 et 1000 unités.', 'error');
    if (size < minWorld)
      return showToast(`Des éléments existent jusqu'à ${minWorld} unités : la carte ne peut pas être plus petite.`, 'error');
    const { error } = await onSave({ ...settings, km_per_unit: k, walk_kmh: w, world_size: size });
    if (error)
      showToast(
        /world_size/.test(error)
          ? 'Taille non enregistrée : la migration 0112 doit être jouée sur Supabase.'
          : "Impossible d'enregistrer l'échelle.",
        'error'
      );
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
          setWorld(String(settings.world_size));
          setOpen(true);
        }}
        data-guide="scale"
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
        <Modal title="Échelle et taille de la carte" onClose={() => setOpen(false)} maxWidth="max-w-xs"
          footer={
            <button onClick={save} className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper">
              Enregistrer
            </button>
          }
        >
          <div className="space-y-3">
            <label className="block space-y-1 text-[11px] uppercase tracking-wide text-paper/65">
              1 unité de carte = … {settings.unit_label}
              <input
                value={km}
                onChange={(e) => setKm(e.target.value)}
                inputMode="decimal"
                className="w-full glass-input rounded-lg px-3 py-2 text-sm normal-case outline-none"
              />
            </label>
            <p className="text-[10px] text-paper/65">
              La carte entière fait {world || '?'} unités de large : avec {km || '?'} {settings.unit_label}/unité, elle mesure{' '}
              {Math.round((Number(km.replace(',', '.')) || 0) * (Number(world.replace(',', '.')) || 0))} {settings.unit_label}.
            </p>
            <label className="block space-y-1 text-[11px] uppercase tracking-wide text-paper/65">
              Vitesse de marche ({settings.unit_label}/h)
              <input
                value={walk}
                onChange={(e) => setWalk(e.target.value)}
                inputMode="decimal"
                className="w-full glass-input rounded-lg px-3 py-2 text-sm normal-case outline-none"
              />
            </label>
            <div className="space-y-1 border-t border-white/10 pt-3">
              <label className="block space-y-1 text-[11px] uppercase tracking-wide text-paper/65">
                Taille de la carte (unités de côté)
                <input
                  value={world}
                  onChange={(e) => setWorld(e.target.value)}
                  inputMode="numeric"
                  className="w-full glass-input rounded-lg px-3 py-2 text-sm normal-case outline-none"
                />
              </label>
              <div className="flex gap-1.5">
                {[50, 100, 200].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setWorld(String(Math.min(1000, (Math.round(Number(world.replace(',', '.'))) || settings.world_size) + n)))}
                    className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-paper/75 hover:border-accent hover:text-accent"
                  >
                    +{n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-paper/65">
                100 = taille d'origine, 1000 au maximum. Agrandir ajoute de l'espace à droite et en bas : rien de ce
                qui existe ne bouge, et les distances ne changent pas.
                {minWorld > 100 && ` Minimum actuel : ${minWorld} (des éléments vont jusque-là).`}
              </p>
            </div>
            <p className="text-[10px] text-paper/65">
              Les montures qui volent utilisent cette échelle : temps de vol = distance ÷ vitesse (vitesse propre à la monture, ou marche × multiplicateur).
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
