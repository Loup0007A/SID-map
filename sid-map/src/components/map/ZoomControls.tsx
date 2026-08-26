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
    <div className="flex flex-col border border-white/15 bg-panel">
      <button
        onClick={onZoomIn}
        title="Zoomer"
        className="border-b border-white/15 px-2.5 py-1.5 font-display text-sm text-paper/80 hover:bg-panel2 hover:text-accent"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        title="Dézoomer"
        className="border-b border-white/15 px-2.5 py-1.5 font-display text-sm text-paper/80 hover:bg-panel2 hover:text-accent"
      >
        −
      </button>
      <button
        onClick={onReset}
        title="Réinitialiser la vue"
        className="px-2.5 py-1.5 font-display text-[10px] text-paper/60 hover:bg-panel2 hover:text-accent"
      >
        ⤾
      </button>
    </div>
  );
}
