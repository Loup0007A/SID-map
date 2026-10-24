'use client';

/**
 * Dessins et animations des décors d'événement (Halloween, Noël, fêtes de
 * l'année, Grande Chasse). Chargé seulement quand un événement est affiché :
 * voir EventDecor.tsx. Fichier identique dans la Cartographie et le Wiki.
 */

import { useEffect, useId, useState } from 'react';
import { Bird, BleuetHead, MiniArt, MuguetSprig, type MiniKind } from './eventArt';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

// Horizons du Wiki (chargés seulement sur le Wiki, pendant une fête).
const Horizon = dynamic(() => import('./EventHorizons').then((m) => m.Horizon), { ssr: false });
const HorizonFireworks = dynamic(() => import('./EventHorizons').then((m) => m.HorizonFireworks), { ssr: false });

export const HOLIDAYS = ['saint_valentin', 'poisson_avril', 'paques', 'premier_mai', 'fete_musique', 'quatorze_juillet', 'armistice'] as const;
export type HolidayKey = (typeof HOLIDAYS)[number];

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

export function HalloweenLayer({ variant, on }: { variant: 'map' | 'wiki'; on: boolean }) {
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
          <Horizon kind="halloween" />
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

export function NoelLayer({ variant, on }: { variant: 'map' | 'wiki'; on: boolean }) {
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
          <Horizon kind="noel" />
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

/* =====================================================================
   Fêtes de l'année (une à la fois : la première affichée de la liste)
   ===================================================================== */

type GarlandKind = 'hearts' | 'fish' | 'eggs' | 'muguet' | 'notes' | 'bunting' | 'bleuets';
type FloatKind = 'heart' | 'fish' | 'egg' | 'muguet' | 'note' | 'flag' | 'bleuet';

const HOLIDAY_SPEC: Record<HolidayKey, { garland: GarlandKind; float: FloatKind; per?: number }> = {
  saint_valentin: { garland: 'hearts', float: 'heart' },
  poisson_avril: { garland: 'fish', float: 'fish' },
  paques: { garland: 'eggs', float: 'egg' },
  premier_mai: { garland: 'muguet', float: 'muguet' },
  fete_musique: { garland: 'notes', float: 'note' },
  quatorze_juillet: { garland: 'bunting', float: 'flag' },
  armistice: { garland: 'bleuets', float: 'bleuet', per: 2 },
};

const HEART_C = ['#ff4d7a', '#ffb3c8', '#e2325f'];
const NOTE_C = ['#c9a6ff', '#ff9c6e', '#6ec8ff'];
const NOTE_K: MiniKind[] = ['note', 'notes', 'noteBeam'];

function SmallBleuet({ r = 1 }: { r?: number }) {
  return (
    <g transform={`scale(${(r * 0.5).toFixed(3)})`}>
      <BleuetHead />
    </g>
  );
}

function GarlandItem({ kind, i }: { kind: GarlandKind; i: number }) {
  switch (kind) {
    case 'hearts':
      return <MiniArt kind="heart" size={15} y={10} color={HEART_C[i % 3]} className="hy-g-heart" />;
    case 'fish':
      return (
        <g transform={`translate(0 6) rotate(${i % 2 ? 8 : -8})`}>
          <path d="M-9 0 C-6 -5 2 -6 6 -2 L10 -5 L9.5 0 L10 5 L6 2 C2 6 -6 5 -9 0 Z" className={`hy-g-fish hy-c${i % 4}`} />
          <circle cx="-5.5" cy="-0.8" r="1" fill="#1b1b24" />
        </g>
      );
    case 'eggs':
      return <ellipse cx="0" cy="9" rx="5" ry="6.6" className={`hy-g-egg hy-c${i % 5}`} />;
    case 'muguet':
      return (
        <g transform="translate(0 2)">
          <path d="M0 0 Q2 6 0 12" fill="none" stroke="#4f9a5d" strokeWidth="1" />
          <MiniArt kind="bell" size={9} y={15} color="#fbfff7" className="hy-g-bell" />
        </g>
      );
    case 'notes':
      return (
        <MiniArt kind={NOTE_K[i % 3]} size={15} y={10} color={NOTE_C[i % 3]} />
      );
    case 'bunting':
      return <path d="M-7 1 L7 1 L0 15 Z" className={`hy-g-flag hy-f${i % 3}`} />;
    case 'bleuets':
      return (
        <g transform="translate(0 10)">
          <SmallBleuet />
        </g>
      );
  }
}

function HolidayGarland({ kind, top, width, per: perWide }: { kind: GarlandKind; top: number; width: number; per?: number }) {
  const swag = width < 640 ? 120 : 170;
  const n = Math.ceil(width / swag);
  const sag = width < 640 ? 7 : 10;
  const per = perWide ?? (width < 640 ? 3 : 4);
  let wire = 'M0 1';
  const items: { x: number; y: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * swag;
    wire += ` Q${x0 + swag / 2} ${1 + sag * 2} ${x0 + swag} 1`;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      items.push({ x: x0 + swag * t, y: 1 + 4 * sag * t * (1 - t), i: i * per + k });
    }
  }
  return (
    <svg className={`ev-garland hy-garland hy-garland-${kind}`} style={{ top }} width={width} height={sag * 2 + 26} viewBox={`0 0 ${width} ${sag * 2 + 26}`} aria-hidden>
      <path d={wire} className="hy-wire" />
      {items.map((b) => (
        <g key={b.i} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
          <GarlandItem kind={kind} i={b.i} />
        </g>
      ))}
    </svg>
  );
}

function FloatItem({ kind, i, style, small }: { kind: FloatKind; i: number; style: React.CSSProperties; small?: boolean }) {
  const cls = `hy-float${small ? ' ev-small' : ''}`;
  switch (kind) {
    case 'heart':
      return (
        <svg viewBox="-12 -12 24 24" className={`${cls} hy-float-heart`} style={style} overflow="visible" aria-hidden>
          <MiniArt kind="heart" color={HEART_C[i % 3]} />
        </svg>
      );
    case 'fish':
      return (
        <svg viewBox="0 0 64 34" className={`${cls} hy-float-fish`} style={style} aria-hidden>
          <path d="M6 17 C14 4 34 2 46 12 L58 4 L56 17 L58 30 L46 22 C34 32 14 30 6 17 Z" className={`hy-g-fish hy-c${i % 4}`} />
          <circle cx="14" cy="15" r="2.6" fill="#fff" />
          <circle cx="13.4" cy="15.2" r="1.3" fill="#1b1b24" />
        </svg>
      );
    case 'egg':
      return (
        <svg viewBox="0 0 24 30" className={`${cls} hy-float-egg`} style={style} aria-hidden>
          <path d="M12 1 C5 1 1 12 1 18 C1 25 6 29 12 29 C18 29 23 25 23 18 C23 12 19 1 12 1 Z" className={`hy-g-egg hy-c${i % 5}`} />
          <path d="M2 15 Q7 12 12 15 T22 15 L22.6 18.5 Q17 15.5 12 18.5 T1.4 18.5 Z" className={`hy-g-egg hy-c${(i + 2) % 5}`} />
        </svg>
      );
    case 'muguet':
      return <MuguetSprig className={`${cls} hy-float-muguet`} style={style} />;
    case 'note':
      return (
        <svg viewBox="-12 -12 24 24" className={`${cls} hy-float-note`} style={style} overflow="visible" aria-hidden>
          <MiniArt kind={NOTE_K[(i + 1) % 3]} color={NOTE_C[i % 3]} />
        </svg>
      );
    case 'flag':
      return (
        <svg viewBox="0 0 30 34" className={`${cls} hy-float-flag`} style={style} aria-hidden>
          <path d="M5 2 V33" stroke="#c8ccd8" strokeWidth="1.6" />
          <rect x="6" y="3" width="7" height="13" className="hy-f0" />
          <rect x="13" y="3" width="7" height="13" className="hy-f1" />
          <rect x="20" y="3" width="7" height="13" className="hy-f2" />
        </svg>
      );
    case 'bleuet':
      return (
        <svg viewBox="-10 -10 20 20" className={`${cls} hy-float-bleuet`} style={style} aria-hidden>
          <SmallBleuet />
        </svg>
      );
  }
}

function HolidayFly({ which }: { which: HolidayKey }) {
  switch (which) {
    case 'saint_valentin':
      return (
        <svg viewBox="0 0 80 50" className="hy-fly-art hy-winged" aria-hidden>
          <path className="hy-wing hy-wing-l" d="M38 22 C30 6 14 4 6 12 C18 14 22 20 24 28 C30 24 34 24 38 26 Z" />
          <path className="hy-wing hy-wing-r" d="M42 22 C50 6 66 4 74 12 C62 14 58 20 56 28 C50 24 46 24 42 26 Z" />
          <path className="hy-fly-heart" d="M40 44 C30 37 26 32 26 27 C26 23 29 20.5 32.5 20.5 C35.5 20.5 38 22 40 25 C42 22 44.5 20.5 47.5 20.5 C51 20.5 54 23 54 27 C54 32 50 37 40 44 Z" />
        </svg>
      );
    case 'poisson_avril':
      return (
        <svg viewBox="0 0 64 34" className="hy-fly-art" aria-hidden>
          <path d="M6 17 C14 4 34 2 46 12 L58 4 L56 17 L58 30 L46 22 C34 32 14 30 6 17 Z" className="hy-g-fish hy-c0" />
          <path d="M22 7 C26 12 26 22 22 27 M30 6 C34 12 34 22 30 28" fill="none" stroke="rgb(0 0 0 / 0.18)" strokeWidth="1.6" />
          <circle cx="14" cy="15" r="2.6" fill="#fff" />
          <circle cx="13.4" cy="15.2" r="1.3" fill="#1b1b24" />
        </svg>
      );
    case 'paques':
      return (
        <svg viewBox="0 0 120 80" className="hy-fly-art" aria-hidden>
          {[
            [40, 28, -12],
            [78, 22, 10],
          ].map(([x, y, r], k) => (
            <g key={k} transform={`translate(${x} ${y}) rotate(${r})`} className="hy-bell">
              <path d="M-16 18 C-16 2 -10 -12 0 -12 C10 -12 16 2 16 18 L20 22 L-20 22 Z" />
              <circle cy="25" r="4" className="hy-bell-clapper" />
              <path d="M-6 -12 C-14 -24 -4 -26 0 -16 C4 -26 14 -24 6 -12" className="hy-ribbon" />
            </g>
          ))}
        </svg>
      );
    case 'premier_mai':
    case 'armistice':
      return which === 'premier_mai' ? <Bird kind="pigeon" carry="muguet" className="hy-bird hy-pigeon" /> : <Bird kind="dove" carry="olive" className="hy-bird hy-dove" />;
    case 'fete_musique':
      return (
        <svg viewBox="0 0 160 60" className="hy-fly-art" aria-hidden>
          {(['note', 'notes', 'noteBeam', 'note', 'noteQuarter', 'notes'] as MiniKind[]).map((g, k) => (
            <g key={k} transform={`translate(${k * 26 + 14} ${(22 + Math.sin(k * 1.3) * 16).toFixed(1)})`}>
              <g className="hy-flying-note" style={{ animationDelay: `${k * 0.12}s` }}>
                <MiniArt kind={g} size={26} color={NOTE_C[k % 3]} />
              </g>
            </g>
          ))}
        </svg>
      );
    case 'quatorze_juillet': {
      const v = [
        [0, 0],
        [-14, -8],
        [-14, 8],
        [-28, -16],
        [-28, 16],
        [-28, 0],
        [-42, 0],
      ];
      return (
        <svg viewBox="-200 -40 260 80" className="hy-fly-art hy-patrouille" aria-hidden>
          <rect x="-200" y="-7" width="160" height="4" className="hy-smoke hy-f0" />
          <rect x="-200" y="-1.5" width="160" height="4" className="hy-smoke hy-f1" />
          <rect x="-200" y="4" width="160" height="4" className="hy-smoke hy-f2" />
          {v.map(([x, y], k) => (
            <path key={k} transform={`translate(${x + 20} ${y})`} className="hy-jet" d="M8 0 L-2 -1.6 L-6 -7 L-8 -7 L-6 -1.6 L-12 -1.4 L-14 -4 L-15 -4 L-14.2 0 L-15 4 L-14 4 L-12 1.4 L-6 1.6 L-8 7 L-6 7 L-2 1.6 Z" />
          ))}
        </svg>
      );
    }
  }
}

export function HolidayLayer({ variant, which }: { variant: 'map' | 'wiki'; which: HolidayKey | null }) {
  const [mounted, setMounted] = useState(false);
  const [fly, setFly] = useState(false);
  const [bar, setBar] = useState<{ top: number; width: number } | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!which) return;
    const root = document.documentElement;
    root.classList.add('ev-holiday', `ev-${which}`);
    const measure = () => {
      const el = document.querySelector(variant === 'map' ? 'nav' : 'header');
      setBar({ top: el ? Math.round(el.getBoundingClientRect().bottom) : 0, width: document.documentElement.clientWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!reduce) {
      const key = `sid-ev-fly-${which}`;
      try {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          t = setTimeout(() => setFly(true), 1600);
        }
      } catch {
        t = setTimeout(() => setFly(true), 1600);
      }
    }
    // Le survol s'en va : plus rien n'est animé ensuite (sur la carte en tout cas).
    const gone = setTimeout(() => setFly(false), which === 'armistice' ? 22_000 : 16_000);
    return () => {
      clearTimeout(t);
      clearTimeout(gone);
      window.removeEventListener('resize', measure);
      root.classList.remove('ev-holiday', `ev-${which}`);
    };
  }, [which, variant]);

  if (!mounted || !which) return null;
  const spec = HOLIDAY_SPEC[which];
  return createPortal(
    <>
      {variant === 'wiki' && (
        <div className={`ev-back hy-back hy-back-${which}`} aria-hidden>
          <Horizon kind={which} />
          {which === 'quatorze_juillet' && <HorizonFireworks />}
          {which === 'saint_valentin' && <div className="hy-glow hy-glow-love" />}
          {which === 'paques' && <div className="hy-glow hy-glow-sun" />}
          <div className="hy-floats">
            <FloatItem kind={spec.float} i={0} style={{ left: '10%', animationDelay: '-1.2s' }} />
            <FloatItem kind={spec.float} i={1} small style={{ left: '50%', animationDelay: '-2.8s' }} />
            <FloatItem kind={spec.float} i={2} style={{ left: '84%', animationDelay: '-0.5s' }} />
          </div>
        </div>
      )}
      <div className={`ev-front ev-${variant}`} aria-hidden>
        {bar && <HolidayGarland kind={spec.garland} top={bar.top} width={bar.width} per={spec.per} />}
        {fly && (
          <div className={`hy-fly hy-fly-${which}`}>
            <HolidayFly which={which} />
          </div>
        )}
      </div>
    </>,
    document.body
  );
}


/* =====================================================================
   La Grande Chasse (9–15 mars) : Brasombre, la wyverne des cendres.
   Créature originale du S.I.D. (même dessin que sur le Dossier Central).
   ===================================================================== */

function BrWing({ far = false }: { far?: boolean }) {
  return (
    <g className={`br-wing ${far ? 'br-wing-far' : 'br-wing-near'}`}>
      <path
        className="br-membrane"
        d="M236 122 L214 74 L201 20 C186 14 166 8 150 8 C152 22 142 30 128 30 C120 30 112 30 106 32 C112 46 100 58 88 64 C98 80 100 92 98 104 C118 112 142 122 168 132 Z"
      />
      <path className="br-tatter" d="M150 8 L146 16 L140 12 L134 22 L128 30 M106 32 L100 40 L95 37 L92 48 L88 64 M98 104 L104 110 L112 108 L118 116" />
      <path className="br-bone" d="M236 122 L214 74 L201 20 M201 20 L150 8 M201 20 L106 32 M201 20 L88 64 M201 20 L98 104" />
    </g>
  );
}

function Brasombre({ pose = 'perch', className = '' }: { pose?: 'perch' | 'fly'; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 420 280" className={`brasombre br-${pose} ${className}`} aria-hidden>
      <defs>
        <radialGradient id={`${uid}-eye`}>
          <stop offset="0" stopColor="var(--br-glow2)" />
          <stop offset="0.5" stopColor="var(--br-glow)" stopOpacity="0.8" />
          <stop offset="1" stopColor="var(--br-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <BrWing far />
      <path className="br-body" d="M162 138 C122 132 82 140 50 156 C36 163 24 170 10 178 C24 177 38 173 52 170 C86 166 122 166 162 168 Z" />
      <path className="br-spike" d="M128 135 l5 -13 l6 12 Z M104 139 l5 -12 l5 12 Z M80 146 l4 -11 l5 11 Z M58 154 l4 -10 l4 10 Z M38 162 l3 -8 l4 8 Z" />
      <path className="br-tail-fan" d="M16 178 C4 174 -4 166 -6 156 C2 162 8 166 14 168 C6 160 4 150 8 140 C12 152 18 162 24 168 C22 160 24 152 30 146 C30 158 30 166 32 172 Z" />
      {pose === 'perch' ? (
        <path className="br-dark" d="M196 168 C206 176 210 190 204 208 L198 236 L212 246 L192 248 L182 244 L188 230 L186 208 C180 194 184 178 196 168 Z" />
      ) : (
        <path className="br-dark" d="M196 168 C206 174 210 184 202 194 L184 210 L172 214 L176 206 L190 194 C184 186 186 176 196 168 Z" />
      )}
      <path className="br-body" d="M150 140 C170 108 230 100 270 112 C292 118 304 132 300 150 C296 172 270 186 236 188 C200 190 168 184 152 170 C144 162 144 150 150 140 Z" />
      <path className="br-plate" d="M176 122 C196 112 222 110 246 114 L240 122 C222 118 200 120 182 128 Z M188 134 C206 126 230 124 252 128 L246 136 C228 132 208 134 194 140 Z" />
      <path className="br-spike" d="M178 116 l4 -14 l7 12 Z M200 109 l5 -15 l7 13 Z M224 107 l5 -14 l6 13 Z M248 110 l5 -12 l5 11 Z" />
      <path className="br-fissure" d="M186 176 C204 182 230 182 254 176 M200 160 L212 166 L224 158 L238 166 M252 150 L262 142 L274 152" />
      {pose === 'perch' ? (
        <path className="br-body" d="M222 166 C238 170 248 186 242 206 L234 236 L250 248 L228 250 L216 246 L224 230 L220 206 C212 192 210 176 222 166 Z" />
      ) : (
        <path className="br-body" d="M222 166 C238 170 246 182 238 194 L220 210 L206 216 L210 206 L224 194 C214 186 212 174 222 166 Z" />
      )}
      <path className="br-body" d="M268 120 C286 104 300 92 318 84 L334 94 C320 102 308 114 300 134 Z" />
      <path className="br-horn" d="M330 75 C320 58 306 51 288 54 C302 60 314 68 322 81 Z" />
      <path className="br-horn" d="M341 72 C337 52 327 39 311 32 C322 45 330 58 332 76 Z" />
      <path className="br-body" d="M316 78 C330 70 350 69 366 75 L392 86 C397 88 397 92 392 94 L372 98 L389 104 C382 109 370 109 360 107 C346 105 330 100 318 94 C309 90 309 82 316 78 Z" />
      <path className="br-fissure" d="M330 84 L340 88 L352 86 M362 92 L372 90" />
      <circle className="br-eye-halo" cx="352" cy="82" r="11" fill={`url(#${uid}-eye)`} />
      <circle className="br-eye" cx="352" cy="82" r="3.2" />
      <BrWing />
    </svg>
  );
}

function ChassePennants({ top, width }: { top: number; width: number }) {
  const swag = width < 640 ? 120 : 170;
  const n = Math.ceil(width / swag);
  const sag = width < 640 ? 7 : 10;
  const per = width < 640 ? 3 : 4;
  let wire = 'M0 1';
  const items: { x: number; y: number; i: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * swag;
    wire += ` Q${x0 + swag / 2} ${1 + sag * 2} ${x0 + swag} 1`;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      items.push({ x: x0 + swag * t, y: 1 + 4 * sag * t * (1 - t), i: i * per + k });
    }
  }
  return (
    <svg className="ev-garland gc-garland" style={{ top }} width={width} height={sag * 2 + 30} viewBox={`0 0 ${width} ${sag * 2 + 30}`} aria-hidden>
      <path d={wire} className="gc-wire" />
      {items.map((b) => (
        <g key={b.i} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
          {b.i % 4 === 0 ? (
            <path className="gc-fang" d="M-2 1 C-3 8 -1 14 0 18 C1 14 3 8 2 1 Z" />
          ) : (
            <g className={`gc-pennant gc-p${b.i % 3}`}>
              <path className="gc-cloth" d="M-8 1 L8 1 L6 14 L0 22 L-6 14 Z" />
              <path className="gc-mark" d="M-3 6 L-1 14 M0 5 L1 14 M3 6 L3 13" />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

export function ChasseLayer({ variant }: { variant: 'map' | 'wiki' }) {
  const [mounted, setMounted] = useState(false);
  const [fly, setFly] = useState(false);
  const [bar, setBar] = useState<{ top: number; width: number } | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('ev-grande_chasse');
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
        if (!sessionStorage.getItem('sid-ev-fly-grande_chasse')) {
          sessionStorage.setItem('sid-ev-fly-grande_chasse', '1');
          t = setTimeout(() => setFly(true), 1400);
        }
      } catch {
        t = setTimeout(() => setFly(true), 1400);
      }
    }
    // Elle est passée : plus rien n'est animé ensuite (sur la carte en tout cas).
    const gone = setTimeout(() => setFly(false), 10_000);
    return () => {
      clearTimeout(t);
      clearTimeout(gone);
      window.removeEventListener('resize', measure);
      root.classList.remove('ev-grande_chasse');
    };
  }, [variant]);

  if (!mounted) return null;
  return createPortal(
    <>
      {variant === 'wiki' && (
        <div className="ev-back gc-back" aria-hidden>
          <div className="gc-glow" />
          <svg className="gc-spire" viewBox="0 0 220 200" aria-hidden>
            <path className="gc-rock" d="M40 200 L70 120 L84 126 L98 70 L112 78 L126 40 L150 92 L164 86 L184 150 L200 200 Z" />
            <path className="gc-lava" d="M126 40 L120 70 L128 96 L122 130 M150 92 L146 120" />
          </svg>
          <div className="gc-perch">
            <Brasombre pose="perch" className="gc-silhouette" />
          </div>
          <div className="gc-embers">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} style={{ left: `${6 + ((i * 37) % 90)}%`, animationDelay: `${-i * 1.1}s`, animationDuration: `${6 + (i % 4)}s` }} />
            ))}
          </div>
        </div>
      )}
      <div className={`ev-front ev-${variant}`} aria-hidden>
        {bar && <ChassePennants top={bar.top} width={bar.width} />}
        {fly && (
          <>
            <div className="gc-pass-shadow" />
            <div className="gc-pass">
              <Brasombre pose="fly" />
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}
