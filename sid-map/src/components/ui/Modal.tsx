'use client';

export default function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="dossier-corner w-full max-w-md border border-white/10 bg-panel">
        <div className="stamp-bar h-1" />
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-sm uppercase tracking-wide text-accent">{title}</h3>
            <button onClick={onClose} className="text-paper/50 hover:text-accent">
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
