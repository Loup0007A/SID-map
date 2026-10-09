'use client';

import { useEffect, useRef, useState } from 'react';

const SIZES = [0.9, 1, 1.125, 1.25, 1.4];
const KEY = 'wiki-text-size';

function apply(i: number) {
  document.documentElement.style.setProperty('--fs', String(SIZES[i]));
}

/** Un seul bouton « ⋯ » : partager, imprimer, taille du texte. */
export default function EntryTools({ title }: { title: string }) {
  const [size, setSize] = useState(1);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem(KEY) ?? '1', 10);
      if (v >= 0 && v < SIZES.length) {
        setSize(v);
        apply(v);
      }
    } catch {}
    return () => {
      document.documentElement.style.removeProperty('--fs');
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function change(delta: number) {
    const next = Math.min(SIZES.length - 1, Math.max(0, size + delta));
    setSize(next);
    apply(next);
    try {
      localStorage.setItem(KEY, String(next));
    } catch {}
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} — Wiki du S.I.D.`, url });
        setOpen(false);
        return;
      }
    } catch {
      return; // partage annulé
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie ce lien :', url);
    }
  }

  const item = 'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-white/10';

  return (
    <div ref={ref} className="no-print relative">
      <button type="button" className="btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Options de la fiche" title="Options">
        ⋯
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-60 rounded-2xl border border-white/20 bg-[#0b1730] p-2 shadow-2xl shadow-black/60 sm:left-auto sm:right-0">
          <button type="button" className={item} onClick={share}>
            {copied ? '✅ Lien copié' : '🔗 Partager'}
          </button>
          <button type="button" className={`${item} hidden sm:flex`} onClick={() => window.print()}>
            🖨 Imprimer
          </button>
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm font-bold">
            Taille du texte
            <span className="inline-flex overflow-hidden rounded-full border border-white/20">
              <button type="button" className="px-3 py-1 hover:bg-white/10 disabled:opacity-30" onClick={() => change(-1)} disabled={size === 0} aria-label="Réduire le texte">
                A−
              </button>
              <button type="button" className="px-3 py-1 hover:bg-white/10 disabled:opacity-30" onClick={() => change(1)} disabled={size === SIZES.length - 1} aria-label="Agrandir le texte">
                A+
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
