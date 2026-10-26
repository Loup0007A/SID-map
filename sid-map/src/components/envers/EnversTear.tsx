'use client';

import { useEffect, useRef } from 'react';
import EnversBackdrop from './EnversBackdrop';

/**
 * La feuille se déchire à l'endroit du clic : le papier se tend (une onde),
 * une fente lumineuse court dans le vélin, la carte tremble, puis la fente
 * s'ouvre en lèvres de papier déchiré (fibres claires, ombre portée, braise
 * sur le bord) jusqu'à laisser toute la place à L'Envers.
 */

type P = { x: number; y: number };

const STRAIN = 260; // l'onde dans le papier
const CRACK = 900; // la fente court
const HOLD = 1150; // le papier hésite
const OPEN = 2750; // la déchirure s'ouvre : d'abord une lèvre, puis tout cède
const DONE = 2900;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export default function EnversTear({ origin, onOpened, clock }: { origin: P; onOpened: () => void; clock?: () => number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<SVGPathElement>(null);
  const fiberRef = useRef<SVGPathElement>(null);
  const shadowRef = useRef<SVGPathElement>(null);
  const emberRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const flecksRef = useRef<SVGGElement>(null);
  const branchRef = useRef<SVGGElement>(null);
  const done = useRef(onOpened);
  done.current = onOpened;

  useEffect(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const D = Math.hypot(W, H);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rand = rng(Math.floor(origin.x * 131 + origin.y * 7919));
    const angle = (-35 + rand() * 70) * (Math.PI / 180);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Contour de la déchirure : une lentille irrégulière, dents fines et
    // grandes échancrures, figées une fois pour toutes.
    const N = 120;
    const coarse = Array.from({ length: 9 }, () => rand());
    const noise = Array.from({ length: N }, (_, i) => {
      const k = (i / N) * coarse.length;
      const a = coarse[Math.floor(k) % coarse.length];
      const b = coarse[(Math.floor(k) + 1) % coarse.length];
      const smooth = a + (b - a) * (k - Math.floor(k));
      return 0.82 + smooth * 0.32 + (rand() - 0.5) * 0.09;
    });
    const fiber = Array.from({ length: N }, () => (rand() - 0.5) * 2);

    const shape = (a: number, b: number, fiberAmp: number) => {
      let d = '';
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        const n = noise[i];
        // Les pointes de la fente restent aiguës : un « œil » plutôt qu'une ellipse.
        const lx = a * Math.cos(t) * n;
        const ly = b * Math.sin(t) * Math.pow(Math.abs(Math.sin(t)), 0.15) * n + fiber[i] * fiberAmp;
        const x = origin.x + lx * cos - ly * sin;
        const y = origin.y + lx * sin + ly * cos;
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return d + 'Z';
    };

    // Fêlures secondaires : quelques cheveux d'or qui partent de la fente.
    const branches = Array.from({ length: 6 }, (_, k) => {
      const along = (k % 2 ? 1 : -1) * (0.25 + rand() * 0.65) * D * 0.2;
      const side = rand() < 0.5 ? -1 : 1;
      const dir = side * (0.5 + rand() * 0.6);
      let px = along;
      let py = 0;
      let len = 0;
      let dd = '';
      const pts: P[] = [];
      for (let j = 0; j < 4; j++) {
        const step = 10 + rand() * 18;
        const ang = dir + (rand() - 0.5) * 0.9 + (along > 0 ? 0.15 : -0.15);
        const nx = px + Math.sin(ang) * step * (along > 0 ? 1 : -1) * 0.6;
        const ny = py + Math.cos(ang) * step * side;
        pts.push({ x: nx, y: ny });
        len += Math.hypot(nx - px, ny - py);
        px = nx;
        py = ny;
      }
      const toScreen = (q: P) => ({ x: origin.x + q.x * cos - q.y * sin, y: origin.y + q.x * sin + q.y * cos });
      const s0 = toScreen({ x: along, y: 0 });
      dd = `M${s0.x.toFixed(1)} ${s0.y.toFixed(1)}` + pts.map((q) => { const v = toScreen(q); return `L${v.x.toFixed(1)} ${v.y.toFixed(1)}`; }).join('');
      return { d: dd, len, at: Math.abs(along) / (D * 0.2) };
    });
    const bg = branchRef.current;
    if (bg) {
      bg.innerHTML = '';
      for (const br of branches) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('d', br.d);
        el.setAttribute('stroke-dasharray', `${br.len.toFixed(1)} ${br.len.toFixed(1)}`);
        el.setAttribute('stroke-dashoffset', br.len.toFixed(1));
        bg.appendChild(el);
      }
    }

    // Éclats de papier et d'encre le long de la fente.
    const flecks = Array.from({ length: 26 }, () => {
      const along = (rand() - 0.5) * 2;
      const side = rand() < 0.5 ? -1 : 1;
      return { along, side, speed: 40 + rand() * 110, size: 1 + rand() * 2.4, drift: (rand() - 0.5) * 50, light: rand() < 0.6 };
    });
    const g = flecksRef.current;
    if (g) {
      g.innerHTML = '';
      for (const f of flecks) {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        c.setAttribute('width', String(f.size * 1.6));
        c.setAttribute('height', String(f.size));
        c.setAttribute('rx', '0.4');
        c.setAttribute('fill', f.light ? '#f2e7cb' : '#f3c77a');
        g.appendChild(c);
      }
    }

    const scale = reduce ? 0.25 : 1;
    const nowMs = clock ?? (() => performance.now());
    const start = nowMs();
    let raf = 0;
    let fired = false;

    const frame = () => {
      const t = (nowMs() - start) / scale;

      // 1) L'onde : le papier se tend.
      const ts = clamp(t / STRAIN);
      if (ringRef.current) {
        ringRef.current.setAttribute('r', String(6 + easeOut(ts) * 46));
        ringRef.current.setAttribute('opacity', String(t < STRAIN ? 0.7 * (1 - ts) : 0));
      }

      // 2) La fente, puis 3) l'ouverture.
      const tc = clamp((t - STRAIN * 0.6) / (CRACK - STRAIN * 0.6));
      const to = clamp((t - HOLD) / (OPEN - HOLD));
      // D'abord les lèvres s'écartent un peu (on devine le dessous),
      // puis la feuille cède d'un coup.
      const lip = easeOut(clamp(to / 0.42));
      const give = easeIn(clamp((to - 0.36) / 0.64));
      const eo = Math.min(1, lip * 0.25 + give);
      const a = easeOut(tc) * D * 0.2 + lip * D * 0.06 + give * D * 1.3;
      const b = 1.2 + tc * 3.2 + lip * D * 0.075 + give * D * 1.05;
      const fiberAmp = 0.8 + tc * 1.6 + eo * 7;
      const d = t < STRAIN * 0.6 ? '' : shape(Math.max(a, 1), b, fiberAmp);

      // Le papier hésite : un petit tremblement, puis il cède.
      if (rootRef.current) {
        const shake = t > CRACK && t < HOLD + 120 ? Math.sin(t * 0.09) * 2.2 * (1 - clamp((t - CRACK) / (HOLD + 120 - CRACK))) : 0;
        rootRef.current.style.transform = shake ? `translate(${shake.toFixed(2)}px, ${(shake * 0.4).toFixed(2)}px)` : '';
      }

      if (backRef.current) backRef.current.style.clipPath = d ? `path('${d}')` : 'circle(0px)';
      for (const el of [edgeRef.current, fiberRef.current, shadowRef.current, emberRef.current]) el?.setAttribute('d', d);
      if (emberRef.current) emberRef.current.setAttribute('opacity', String(t < HOLD ? Math.min(1, tc * 1.6) : Math.max(0, 1 - to * 1.8)));
      if (shadowRef.current) shadowRef.current.setAttribute('opacity', String(Math.min(0.75, tc) * (1 - to * 0.6)));
      if (edgeRef.current) edgeRef.current.setAttribute('stroke-width', String(2 + eo * 9));
      if (fiberRef.current) fiberRef.current.setAttribute('stroke-width', String(1.2 + eo * 5));

      if (bg) {
        const kids = bg.children;
        for (let i = 0; i < branches.length; i++) {
          const el = kids[i] as SVGPathElement | undefined;
          if (!el) continue;
          const grow = clamp((tc - branches[i].at * 0.7) / 0.35);
          el.setAttribute('stroke-dashoffset', (branches[i].len * (1 - easeOut(grow))).toFixed(1));
        }
        bg.setAttribute('opacity', String(t < HOLD ? 1 : Math.max(0, 1 - to * 2.5)));
      }

      if (g) {
        const kids = g.children;
        const life = clamp((t - STRAIN) / 1300);
        for (let i = 0; i < flecks.length; i++) {
          const f = flecks[i];
          const el = kids[i] as SVGRectElement | undefined;
          if (!el) continue;
          const lx = f.along * D * 0.16 * Math.min(1, tc * 1.4);
          const ly = f.side * (b * 0.6 + f.speed * life) + f.drift * life;
          const x = origin.x + lx * cos - ly * sin;
          const y = origin.y + lx * sin + ly * cos + 30 * life * life;
          el.setAttribute('x', x.toFixed(1));
          el.setAttribute('y', y.toFixed(1));
          el.setAttribute('transform', `rotate(${(f.drift * life * 6).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})`);
          el.setAttribute('opacity', String(t < STRAIN ? 0 : Math.max(0, 1 - life) * 0.9));
        }
      }

      if (!fired && t >= DONE) {
        fired = true;
        done.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [origin.x, origin.y]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} className="fixed inset-0 z-[70] cursor-wait" style={{ pointerEvents: 'auto' }}>
      <div ref={backRef} className="absolute inset-0" style={{ clipPath: 'circle(0px)' }}>
        <EnversBackdrop />
      </div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <filter id="envers-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="envers-ember" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g ref={branchRef} fill="none" stroke="#f6d48e" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" filter="url(#envers-ember)" />
        <circle ref={ringRef} cx={origin.x} cy={origin.y} r="6" fill="none" stroke="#fff6dc" strokeWidth="1.2" opacity="0" />
        {/* Ombre portée des lèvres sur la carte. */}
        <path ref={shadowRef} fill="none" stroke="#1b140c" strokeWidth="16" filter="url(#envers-soft)" opacity="0" />
        {/* Tranche du vélin déchiré, puis ses fibres. */}
        <path ref={edgeRef} fill="none" stroke="#f1e6c9" strokeLinejoin="round" />
        <path ref={fiberRef} fill="none" stroke="#c9b48a" strokeDasharray="1.5 2.5 0.8 3.5" strokeLinecap="round" opacity="0.9" />
        {/* Braise sur le bord, le temps que ça s'ouvre. */}
        <path ref={emberRef} fill="none" stroke="#f6c46e" strokeWidth="2.2" filter="url(#envers-ember)" opacity="0" />
        <g ref={flecksRef} />
      </svg>
    </div>
  );
}
