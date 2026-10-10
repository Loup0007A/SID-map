'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { tourSteps, type Audience, type TourStep } from '@/lib/guide';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const CARD_W = 320;

function findTarget(target?: string): Box | null {
  if (!target) return null;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-guide="${target}"]`));
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

// Visite guidée : assombrit l'écran, découpe un halo autour de l'élément
// visé et pose une carte explicative à côté. Sans cible visible, la carte
// se place au centre.
export default function GuideTour({
  kind,
  onStep,
  onEnd
}: {
  kind: Audience | 'full';
  onStep: (s: TourStep | null) => void;
  onEnd: () => void;
}) {
  const steps = tourSteps(kind);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(200);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const measure = useCallback(() => setBox(findTarget(step.target)), [step.target]);

  useEffect(() => {
    onStep(step);
    // La carte déplie parfois un panneau en réaction à l'étape : on
    // re-mesure après son rendu.
    measure();
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, measure]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, box]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd();
      else if (e.key === 'ArrowRight') (last ? onEnd() : setIndex((i) => i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [last, onEnd]);

  // Position de la carte : sous la cible si la place existe, sinon
  // au-dessus, sinon au centre.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const w = Math.min(CARD_W, vw - 24);
  let style: React.CSSProperties;
  if (box) {
    const below = box.top + box.height + PAD + 12;
    const above = box.top - PAD - 12 - cardH;
    const top = below + cardH <= vh - 12 ? below : above >= 12 ? above : Math.max(12, (vh - cardH) / 2);
    const left = Math.min(vw - w - 12, Math.max(12, box.left + box.width / 2 - w / 2));
    style = { top, left, width: w };
  } else {
    style = { top: Math.max(12, (vh - cardH) / 2), left: (vw - w) / 2, width: w };
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`Visite guidée : ${step.title}`}>
      {box ? (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-[#e7c34a] transition-all duration-200"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(8, 9, 14, 0.72)'
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(8,9,14,0.72)]" />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        style={style}
        className="glass-strong absolute overflow-hidden rounded-2xl outline-none transition-all duration-200"
      >
        <div className="stamp-bar h-1" />
        <div className="space-y-2 p-4">
          <p className="font-display text-[10px] uppercase tracking-wide text-paper/50">
            Visite guidée · {index + 1}/{steps.length}
          </p>
          <h3 className="font-display text-sm uppercase tracking-wide text-accent">{step.title}</h3>
          <p className="text-sm leading-relaxed text-paper/85">{step.body}</p>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={onEnd} className="mr-auto text-xs text-paper/50 underline hover:text-accent">
              {last ? 'Fermer' : 'Passer la visite'}
            </button>
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper/70 hover:border-accent hover:text-accent"
              >
                Précédent
              </button>
            )}
            <button
              onClick={() => (last ? onEnd() : setIndex((i) => i + 1))}
              className="btn-accent rounded-lg px-3 py-1.5 text-xs font-semibold text-paper"
            >
              {last ? 'Terminer' : index === 0 ? 'Commencer' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
