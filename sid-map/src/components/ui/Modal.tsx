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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-gold/30 bg-ink p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">{title}</h3>
          <button onClick={onClose} className="text-parchment/60 hover:text-gold">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
