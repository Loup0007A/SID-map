'use client';

export default function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="glass flex flex-col overflow-hidden rounded-xl">
      <button
        onClick={onZoomIn}
        title="Zoomer"
        className="border-b border-white/10 px-3 py-2 font-display text-sm text-paper/80 hover:bg-white/10 hover:text-accent"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        title="Dézoomer"
        className="border-b border-white/10 px-3 py-2 font-display text-sm text-paper/80 hover:bg-white/10 hover:text-accent"
      >
        −
      </button>
      <button
        onClick={onReset}
        title="Réinitialiser la vue"
        className="px-3 py-2 font-display text-[10px] text-paper/60 hover:bg-white/10 hover:text-accent"
      >
        ⤾
      </button>
    </div>
  );
}
