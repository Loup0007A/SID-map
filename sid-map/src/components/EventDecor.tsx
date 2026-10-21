'use client';

/**
 * Affichage événementiel (Halloween, Noël) — même réglage que le Dossier
 * Central (fonction site_decor, Modération → Affichage événementiel).
 * Fichier identique dans la Cartographie et le Wiki ; seul le style change
 * (variant). Rien ne capte les clics ; rien ne tourne en boucle sur la carte.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';

type Decor = { halloween: boolean; noel: boolean };
let cache: { at: number; value: Decor } | null = null;

export function useEventDecor(): Decor | null {
  const [decor, setDecor] = useState<Decor | null>(cache?.value ?? null);
  useEffect(() => {
    if (cache && Date.now() - cache.at < 5 * 60_000) {
      setDecor(cache.value);
      return;
    }
    let alive = true;
    createClient()
      .rpc('site_decor')
      .then(({ data, error }) => {
        const d = (error ? null : data) as Partial<Decor> | null;
        const value: Decor = { halloween: !!d?.halloween, noel: !!d?.noel };
        cache = { at: Date.now(), value };
        if (alive) setDecor(value);
      });
    return () => {
      alive = false;
    };
  }, []);
  return decor;
}

function Bat({ style }: { style?: React.CSSProperties }) {
  const wing = 'M32 17 C27 9 17 6 5 10 C9 12 10.5 15 9.5 19.5 C13 16.5 16.5 17.5 18.5 21.5 C20.5 17.5 24 17.5 27 20.5 C28.5 18.5 30 17.8 32 18.6 Z';
  return (
    <svg viewBox="0 0 64 32" className="ev-bat" style={style} aria-hidden>
      <g className="ev-wing ev-wing-l">
        <path d={wing} />
      </g>
      <g className="ev-wing ev-wing-r">
        <path d={wing} transform="translate(64 0) scale(-1 1)" />
      </g>
      <ellipse cx="32" cy="18" rx="3.6" ry="5.6" />
      <path d="M29.6 13.4 L30.4 9.2 L31.6 12.6 Z M34.4 13.4 L33.6 9.2 L32.4 12.6 Z" />
      <circle cx="30.9" cy="15.6" r="0.55" className="ev-eye" />
      <circle cx="33.1" cy="15.6" r="0.55" className="ev-eye" />
    </svg>
  );
}

function Cobweb() {
  const angles = [0, 14, 30, 47, 63, 78, 90].map((a) => (a * Math.PI) / 180);
  const pt = (a: number, r: number) => [Math.cos(a) * r, Math.sin(a) * r];
  return (
    <svg viewBox="0 0 120 120" className="ev-web" aria-hidden>
      {angles.map((a, i) => {
        const [x, y] = pt(a, 170);
        return <line key={i} x1="0" y1="0" x2={x} y2={y} />;
      })}
      {[24, 46, 70, 96].map((r, k) => (
        <path
          key={k}
          d={angles
            .slice(1)
            .map((a, i) => {
              const [x0, y0] = pt(angles[i], r);
              const [x1, y1] = pt(a, r);
              const [cx, cy] = pt((angles[i] + a) / 2, r * 0.86);
              return `${i === 0 ? `M${x0.toFixed(1)} ${y0.toFixed(1)} ` : ''}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
            })
            .join(' ')}
        />
      ))}
      <g className="ev-spider">
        <line x1="58" y1="38" x2="58" y2="78" className="ev-thread" />
        <g transform="translate(58 82)">
          <path d="M-2 -1 L-9 -6 L-11 -2 M-2 0 L-10 -1 L-12 3 M-2 1 L-9 4 L-10 9 M-1 2 L-6 7 L-6 12 M2 -1 L9 -6 L11 -2 M2 0 L10 -1 L12 3 M2 1 L9 4 L10 9 M1 2 L6 7 L6 12" className="ev-legs" />
          <ellipse cx="0" cy="2" rx="3.4" ry="4.2" />
          <circle cx="0" cy="-2.6" r="2.2" />
        </g>
      </g>
    </svg>
  );
}

function Pumpkin({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 32 30" className={`ev-pumpkin ${className}`} style={style} aria-hidden>
      <path className="ev-stem" d="M15 6 C15 3 16 1.5 18.5 1 L19 2.6 C17.4 3.2 17 4.4 17 6 Z" />
      <path className="ev-body" d="M16 6 C10 5 3 8 3 17 C3 25 9 29 16 28.4 C23 29 29 25 29 17 C29 8 22 5 16 6 Z" />
      <path className="ev-rib" d="M16 6.5 C12 10 12 24 16 28 M16 6.5 C20 10 20 24 16 28 M9 7.6 C6 12 6.5 22 10.5 27 M23 7.6 C26 12 25.5 22 21.5 27" />
      <path className="ev-face" d="M9 14 L12.5 12 L13 15.5 Z M23 14 L19.5 12 L19 15.5 Z M8.5 19 Q16 25 23.5 19 L21 19.8 L20 21.6 L18 20.4 L16 22 L14 20.4 L12 21.6 L11 19.8 Z" />
    </svg>
  );
}

const FLOCK = [
  { d: 0, s: 1, y: 0, t: 7.5 },
  { d: 0.35, s: 0.7, y: 34, t: 8.2 },
  { d: 0.6, s: 0.85, y: -26, t: 7.8 },
  { d: 1.1, s: 0.55, y: 60, t: 9 },
];

export default function EventDecor({ variant }: { variant: 'map' | 'wiki' }) {
  const decor = useEventDecor();
  return (
    <>
      <HalloweenLayer variant={variant} on={!!decor?.halloween} />
      <NoelLayer variant={variant} on={!!decor?.noel} />
    </>
  );
}

function HalloweenLayer({ variant, on }: { variant: 'map' | 'wiki'; on: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [flock, setFlock] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('ev-halloween', on);
    if (!on) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      try {
        if (!sessionStorage.getItem('sid-ev-flock')) {
          sessionStorage.setItem('sid-ev-flock', '1');
          t = setTimeout(() => setFlock(true), 1200);
        }
      } catch {
        t = setTimeout(() => setFlock(true), 1200);
      }
    }
    // Les chauves-souris s'en vont : on les retire (plus d'animation en arrière-plan).
    const gone = setTimeout(() => setFlock(false), 13_000);
    return () => {
      clearTimeout(t);
      clearTimeout(gone);
      root.classList.remove('ev-halloween');
    };
  }, [on]);

  if (!mounted || !on) return null;
  return createPortal(
    <>
      {variant === 'wiki' && (
        <div className="ev-back" aria-hidden>
          <div className="ev-moon" />
          <div className="ev-pumpkins">
            <Pumpkin style={{ left: '8%', animationDelay: '-1.2s' }} />
            <Pumpkin className="ev-small" style={{ left: '46%', animationDelay: '-2.6s' }} />
            <Pumpkin style={{ left: '82%', animationDelay: '-0.4s' }} />
          </div>
        </div>
      )}
      <div className={`ev-front ev-${variant}`} aria-hidden>
        <Cobweb />
        {flock &&
          FLOCK.map((b, i) => (
            <Bat key={i} style={{ '--d': `${b.d}s`, '--s': b.s, '--y': `${b.y}px`, '--t': `${b.t}s` } as React.CSSProperties} />
          ))}
      </div>
    </>,
    document.body
  );
}

/* =====================================================================
   Noël
   ===================================================================== */

function Reindeer({ x, nose = false }: { x: number; nose?: boolean }) {
  return (
    <g transform={`translate(${x} 6)`}>
      <ellipse cx="18" cy="16" rx="10" ry="4.4" />
      <path d="M10.5 14 C9 11 7.6 8.6 6.2 7" className="ev-stroke" style={{ strokeWidth: 3.2 }} />
      <ellipse cx="4.6" cy="6.4" rx="3.3" ry="2" transform="rotate(-18 4.6 6.4)" />
      <path d="M6.2 4.6 L7.4 0.8 M7 2.2 L9.6 1 M5 4.8 L3.4 1.2 M3.9 2.6 L1.6 1.9" className="ev-stroke ev-antler" />
      <path d="M11 19 L7.4 23.6 M13.6 19.4 L10.6 25 M23.6 19 L29 22 M25.8 18.2 L31.2 19.6" className="ev-stroke ev-leg" />
      <path d="M27.6 13.2 L30.4 11.6" className="ev-stroke" />
      {nose && <circle cx="1.5" cy="6.9" r="1.25" className="ev-nose" />}
    </g>
  );
}

function Sleigh() {
  return (
    <svg viewBox="-4 -2 176 48" className="ev-sleigh" aria-hidden>
      <path d="M32 21 L44 22 M66 21 L78 22 M100 21 L116 25" className="ev-rein" />
      <Reindeer x={0} nose />
      <Reindeer x={34} />
      <Reindeer x={68} />
      <path d="M118 22 L150 21 Q156 21 155 27 L152 33 L126 33 Q120 33 120 28 Z" />
      <path d="M114 39 L153 39 Q160 39 160 34 M127 33 L125 39 M147 33 L148 39 M114 39 Q110 39 111 35" className="ev-stroke ev-runner" />
      <path d="M140 21 Q138 12 146 12 Q153 12 152 21 Z" />
      <circle cx="131" cy="17" r="5" />
      <circle cx="129.6" cy="10.2" r="3" />
      <path d="M127 8.6 Q130 2.6 135.6 6.4 L137.6 5.2" className="ev-stroke ev-hat" />
      <circle cx="137.8" cy="5" r="1.1" className="ev-pompom" />
      <g className="ev-trail">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={162 + i * 4} cy={36 - (i % 2) * 5} r={1.3 - i * 0.15} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </g>
    </svg>
  );
}

const BULBS = ['r', 'o', 'g', 'b'];

function Garland({ top, width, twinkle }: { top: number; width: number; twinkle: boolean }) {
  const swag = width < 640 ? 120 : 170;
  const n = Math.ceil(width / swag);
  const sag = width < 640 ? 8 : 12;
  const per = width < 640 ? 4 : 5;
  let wire = 'M0 1';
  const bulbs: { x: number; y: number; c: string; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * swag;
    wire += ` Q${x0 + swag / 2} ${1 + sag * 2} ${x0 + swag} 1`;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      bulbs.push({ x: x0 + swag * t, y: 1 + 4 * sag * t * (1 - t), c: BULBS[(i * per + k) % 4], d: ((i * per + k) * 0.37) % 2.6 });
    }
  }
  return (
    <svg className={`ev-garland${twinkle ? ' ev-twinkle' : ''}`} style={{ top }} width={width} height={sag * 2 + 16} viewBox={`0 0 ${width} ${sag * 2 + 16}`} aria-hidden>
      <path d={wire} className="ev-wire" />
      {bulbs.map((b, i) => (
        <g key={i} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
          <rect x="-1.6" y="-0.5" width="3.2" height="3" rx="0.6" className="ev-socket" />
          <ellipse cx="0" cy="6" rx="2.9" ry="4.2" className={`ev-bulb ev-bulb-${b.c}`} style={{ animationDelay: `${b.d.toFixed(2)}s` }} />
        </g>
      ))}
    </svg>
  );
}

function Gift({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" className={`ev-gift ${className}`} style={style} aria-hidden>
      <rect x="4" y="9" width="24" height="6" rx="1.2" className="ev-gift-lid" />
      <rect x="6" y="15" width="20" height="14" rx="1" className="ev-gift-box" />
      <rect x="14" y="9" width="4" height="20" className="ev-gift-ribbon" />
      <path d="M16 9 C12 3 7 5 9.5 8.4 C11 9.6 14 9.4 16 9 C18 9.4 21 9.6 22.5 8.4 C25 5 20 3 16 9 Z" className="ev-gift-ribbon" />
    </svg>
  );
}

function NorthStar() {
  return (
    <svg viewBox="-50 -50 100 100" className="ev-star" aria-hidden>
      <path className="ev-star-rays" d="M0 -48 L3 -3 L48 0 L3 3 L0 48 L-3 3 L-48 0 L-3 -3 Z" />
      <path className="ev-star-core" d="M0 -20 L5 -5 L20 0 L5 5 L0 20 L-5 5 L-20 0 L-5 -5 Z" transform="rotate(45)" />
      <circle r="4.5" className="ev-star-heart" />
    </svg>
  );
}

function NoelLayer({ variant, on }: { variant: 'map' | 'wiki'; on: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [sleigh, setSleigh] = useState(false);
  const [firstSnow, setFirstSnow] = useState(variant === 'map');
  const [bar, setBar] = useState<{ top: number; width: number } | null>(null);
  const [touch, setTouch] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('ev-noel', on);
    if (!on) return;
    setTouch(!!window.matchMedia?.('(hover: none)').matches);
    // La guirlande pend sous la barre du haut.
    const measure = () => {
      const el = document.querySelector(variant === 'map' ? 'nav' : 'header');
      setBar({ top: el ? Math.round(el.getBoundingClientRect().bottom) : 0, width: document.documentElement.clientWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!reduce) {
      try {
        if (!sessionStorage.getItem('sid-ev-sleigh')) {
          sessionStorage.setItem('sid-ev-sleigh', '1');
          t = setTimeout(() => setSleigh(true), 1600);
        }
      } catch {
        t = setTimeout(() => setSleigh(true), 1600);
      }
    } else setFirstSnow(false);
    // Le traîneau et la première neige de la carte s'en vont : plus rien n'est animé ensuite.
    const gone = setTimeout(() => setSleigh(false), 17_000);
    const melt = setTimeout(() => setFirstSnow(false), 14_000);
    return () => {
      clearTimeout(t);
      clearTimeout(gone);
      clearTimeout(melt);
      window.removeEventListener('resize', measure);
      root.classList.remove('ev-noel');
    };
  }, [on, variant]);

  if (!mounted || !on) return null;
  return createPortal(
    <>
      {variant === 'wiki' && (
        <div className="ev-back ev-back-noel" aria-hidden>
          <NorthStar />
          <div className="ev-snow">
            <div className="ev-snow-layer ev-snow-far" />
            <div className="ev-snow-layer ev-snow-mid" />
            {!touch && <div className="ev-snow-layer ev-snow-near" />}
          </div>
          <div className="ev-gifts">
            <Gift style={{ left: '12%', animationDelay: '-1.4s' }} />
            <Gift className="ev-small" style={{ left: '52%', animationDelay: '-3s' }} />
            <Gift style={{ left: '86%', animationDelay: '-0.6s' }} />
          </div>
        </div>
      )}
      <div className={`ev-front ev-${variant}`} aria-hidden>
        {bar && <Garland top={bar.top} width={bar.width} twinkle={variant === 'wiki' && !touch} />}
        {variant === 'map' && firstSnow && (
          <div className="ev-snow ev-snow-once">
            <div className="ev-snow-layer ev-snow-far" />
            <div className="ev-snow-layer ev-snow-mid" />
          </div>
        )}
        {sleigh && (
          <div className="ev-sleigh-fly">
            <Sleigh />
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
