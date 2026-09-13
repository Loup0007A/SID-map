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
      <div className="glass-strong flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl">
        <div className="stamp-bar h-1 shrink-0" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
          <h3 className="font-display text-sm uppercase tracking-wide text-accent">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full h-7 w-7 flex items-center justify-center text-paper/50 hover:bg-white/10 hover:text-accent"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto scrollbar-thin px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
