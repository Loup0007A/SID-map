'use client';

// « Et maintenant ? » — une seule suggestion à la fois, la plus utile
// selon l'état réel de la carte et du personnage. Chaque suggestion peut
// être masquée (mémorisé sur l'appareil) et reste accessible via l'aide.

export interface CoachTip {
  id: string;
  emoji: string;
  text: string;
  action?: { label: string; run: () => void };
  secondary?: { label: string; run: () => void };
  /** ne peut pas être masquée (erreur, voyage en cours) */
  sticky?: boolean;
  tone?: 'info' | 'error';
}

export default function MapCoach({ tip, onDismiss }: { tip: CoachTip | null; onDismiss: (id: string) => void }) {
  if (!tip) return null;
  return (
    <div
      role={tip.tone === 'error' ? 'alert' : 'status'}
      className={`glass-strong absolute left-1/2 top-36 md:top-[4.25rem] z-10 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-start gap-2.5 rounded-2xl p-3 ${
        tip.tone === 'error' ? 'border-accent/60' : ''
      }`}
    >
      <span aria-hidden className="text-lg leading-none">{tip.emoji}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-snug text-paper/90">{tip.text}</p>
        {(tip.action || tip.secondary) && (
          <div className="flex flex-wrap gap-2">
            {tip.action && (
              <button onClick={tip.action.run} className="btn-accent rounded-lg px-3 py-1.5 text-xs font-semibold text-paper">
                {tip.action.label}
              </button>
            )}
            {tip.secondary && (
              <button
                onClick={tip.secondary.run}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper/75 hover:border-accent hover:text-accent"
              >
                {tip.secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
      {!tip.sticky && (
        <button
          onClick={() => onDismiss(tip.id)}
          aria-label="Masquer cette suggestion"
          title="Masquer"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-paper/45 hover:bg-white/10 hover:text-accent"
        >
          ✕
        </button>
      )}
    </div>
  );
}
