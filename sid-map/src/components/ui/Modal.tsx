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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-strong w-full max-w-md rounded-2xl overflow-hidden">
        <div className="stamp-bar h-1" />
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-sm uppercase tracking-wide text-accent">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-full h-7 w-7 flex items-center justify-center text-paper/50 hover:bg-white/10 hover:text-accent"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
