'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
  top?: React.ReactNode; // zone fixe sous le titre (toujours visible)
  /**
   * Donne un identifiant pour obtenir, sur grand écran, une fenêtre
   * flottante : déplaçable par sa barre de titre, redimensionnable par
   * ses bords, non bloquante (la carte reste utilisable derrière). Sa
   * place et sa taille sont mémorisées par appareil. Sur téléphone, la
   * fenêtre reste une modale classique.
   */
  windowId?: string;
}

const DESKTOP = '(min-width: 768px)';

export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const h = () => setDesktop(mq.matches);
    h();
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return desktop;
}

export default function Modal(props: ModalProps) {
  const desktop = useIsDesktop();
  if (props.windowId && desktop) return <FloatingWindow {...props} windowId={props.windowId} />;
  return <BlockingModal {...props} />;
}

function useEscape(onClose: () => void, enabled: () => boolean = () => true) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && enabledRef.current()) closeRef.current();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

function BlockingModal({ title, onClose, children, maxWidth = 'max-w-md', footer, top }: ModalProps) {
  useEscape(onClose);
  return (
    <div
      className="anim-fade fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#03060d]/70 p-3 backdrop-blur-sm sm:p-4"
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`anim-pop glass-strong flex max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl`}>
        <div className="stamp-bar h-1 shrink-0" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
          <h3 className="font-display text-sm uppercase tracking-wide text-accent">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full h-7 w-7 flex items-center justify-center text-paper/50 hover:bg-white/10 hover:text-accent"
          >
            ✕
          </button>
        </div>
        {top && <div className="shrink-0 px-5 pb-3">{top}</div>}
        <div className="min-h-0 overscroll-contain overflow-y-auto scrollbar-thin px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-white/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// --- Fenêtre flottante --------------------------------------------------

interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number | null; // null = hauteur automatique tant qu'on n'a pas redimensionné
}

const WIDTHS: Record<string, number> = { 'max-w-xs': 320, 'max-w-sm': 384, 'max-w-md': 448, 'max-w-lg': 512, 'max-w-xl': 576, 'max-w-2xl': 672, 'max-w-3xl': 768 };
const MIN_W = 260;
const MIN_H = 160;
const NAV = 56; // on ne glisse pas la barre de titre sous la barre du haut
let opened = 0;

// Ordre d'empilement partagé : la dernière fenêtre touchée passe devant.
// Les fenêtres vivent entre la carte (z ≤ 30) et les modales bloquantes (z 40).
const stack: string[] = [];
const listeners = new Set<() => void>();
function raise(id: string) {
  if (stack[stack.length - 1] === id) return;
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
  stack.push(id);
  listeners.forEach((l) => l());
}
function drop(id: string) {
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
  listeners.forEach((l) => l());
}

function clampGeo(g: Geometry): Geometry {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.max(MIN_W, Math.min(g.w, vw - 16));
  const h = g.h == null ? null : Math.max(MIN_H, Math.min(g.h, vh - NAV - 8));
  // Au moins 120 px de la barre de titre restent toujours attrapables.
  const x = Math.max(120 - w, Math.min(g.x, vw - 120));
  const y = Math.max(NAV, Math.min(g.y, vh - 48));
  return { x, y, w, h };
}

type Edge = 'e' | 's' | 'se' | 'w' | 'sw';

function FloatingWindow({ title, onClose, children, maxWidth = 'max-w-md', footer, top, windowId }: ModalProps & { windowId: string }) {
  const key = `sid-win-${windowId}`;
  const [geo, setGeo] = useState<Geometry | null>(null);
  const [, tick] = useState(0);
  const drag = useRef<{ kind: 'move' | Edge; px: number; py: number; start: Geometry } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const defaults = useCallback((): Geometry => {
    const w = Math.min(WIDTHS[maxWidth] ?? 448, window.innerWidth - 32);
    // Léger décalage en cascade pour que deux fenêtres ne se superposent pas exactement.
    const step = (opened++ % 5) * 28;
    return clampGeo({ x: Math.max(16, window.innerWidth - w - 96 - step), y: NAV + 24 + step, w, h: null });
  }, [maxWidth]);

  useEffect(() => {
    let saved: Geometry | null = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const v = JSON.parse(raw);
        if ([v.x, v.y, v.w].every((n: unknown) => typeof n === 'number')) saved = { x: v.x, y: v.y, w: v.w, h: typeof v.h === 'number' ? v.h : null };
      }
    } catch {
      // stockage indisponible : on retombe sur la place par défaut
    }
    setGeo(saved ? clampGeo(saved) : defaults());
    const onResize = () => setGeo((g) => (g ? clampGeo(g) : g));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [key, defaults]);

  const persist = useCallback(
    (g: Geometry) => {
      try {
        localStorage.setItem(key, JSON.stringify(g));
      } catch {
        // sans stockage, la fenêtre reprendra simplement sa place par défaut
      }
    },
    [key]
  );

  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    raise(windowId);
    return () => {
      listeners.delete(l);
      drop(windowId);
    };
  }, [windowId]);

  const focus = () => raise(windowId);
  const order = Math.max(0, stack.indexOf(windowId));
  // Échap ne ferme que la fenêtre du dessus.
  useEscape(onClose, () => stack[stack.length - 1] === windowId);

  function begin(kind: 'move' | Edge, e: React.PointerEvent) {
    if (!geo || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    focus();
    // Une hauteur automatique doit devenir fixe dès qu'on redimensionne.
    const h = kind !== 'move' && geo.h == null ? boxRef.current?.offsetHeight ?? 320 : geo.h;
    drag.current = { kind, px: e.clientX, py: e.clientY, start: { ...geo, h } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    const s = d.start;
    let next: Geometry = s;
    if (d.kind === 'move') next = { ...s, x: s.x + dx, y: s.y + dy };
    else {
      let { x, w } = s;
      let h = s.h ?? MIN_H;
      if (d.kind.includes('e')) w = s.w + dx;
      if (d.kind.includes('w')) {
        w = Math.max(MIN_W, s.w - dx);
        x = s.x + (s.w - w);
      }
      if (d.kind.includes('s')) h = (s.h ?? MIN_H) + dy;
      next = { x, y: s.y, w, h };
    }
    setGeo(clampGeo(next));
  }

  function end() {
    if (!drag.current) return;
    drag.current = null;
    if (geo) persist(geo);
  }

  function reset() {
    opened = 0;
    const g = defaults();
    setGeo(g);
    try {
      localStorage.removeItem(key);
    } catch {
      // rien à effacer
    }
  }

  if (!geo) return null;

  const handle = (kind: Edge, cls: string) => (
    <div
      aria-hidden
      onPointerDown={(e) => begin(kind, e)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`absolute ${cls}`}
      style={{ touchAction: 'none' }}
    />
  );

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={title}
      onPointerDownCapture={focus}
      className="anim-pop glass-strong fixed flex flex-col overflow-hidden rounded-2xl"
      style={{
        left: geo.x,
        top: geo.y,
        width: geo.w,
        height: geo.h ?? undefined,
        maxHeight: geo.h == null ? `calc(100dvh - ${geo.y + 12}px)` : undefined,
        zIndex: 31 + Math.min(order, 8)
      }}
    >
      <div className="stamp-bar h-1 shrink-0" />
      <div
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          begin('move', e);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) reset();
        }}
        title="Glisser pour déplacer · double-clic pour replacer"
        className="flex shrink-0 cursor-move select-none items-center gap-1 px-4 pb-2 pt-3"
        style={{ touchAction: 'none' }}
      >
        <span aria-hidden className="text-paper/30">⠿</span>
        <h3 className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide text-accent">{title}</h3>
        <button
          onClick={reset}
          aria-label="Replacer la fenêtre à sa position et sa taille d'origine"
          title="Replacer"
          className="flex h-7 w-7 items-center justify-center rounded-full text-paper/50 hover:bg-white/10 hover:text-accent"
        >
          ⤾
        </button>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-7 w-7 items-center justify-center rounded-full text-paper/50 hover:bg-white/10 hover:text-accent"
        >
          ✕
        </button>
      </div>
      {top && <div className="shrink-0 px-4 pb-3">{top}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 scrollbar-thin">{children}</div>
      {footer && <div className="shrink-0 border-t border-white/10 px-4 py-3">{footer}</div>}

      {handle('e', 'right-0 top-8 bottom-3 w-1.5 cursor-ew-resize')}
      {handle('w', 'left-0 top-8 bottom-3 w-1.5 cursor-ew-resize')}
      {handle('s', 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize')}
      {handle('sw', 'bottom-0 left-0 h-3 w-3 cursor-nesw-resize')}
      {handle('se', 'bottom-0 right-0 h-4 w-4 cursor-nwse-resize')}
      <span aria-hidden className="pointer-events-none absolute bottom-0.5 right-1 text-[10px] leading-none text-paper/35">◢</span>
    </div>
  );
}
