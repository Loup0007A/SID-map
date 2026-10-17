'use client';

/**
 * Affichage événementiel (Halloween) — même réglage que le Dossier Central
 * (fonction site_decor, Modération → Affichage événementiel). Fichier
 * identique dans la Cartographie et le Wiki ; seul le style change (variant).
 * Rien ne capte les clics ; rien ne tourne en boucle sur la carte.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';

type Decor = { halloween: boolean };
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
        const value: Decor = { halloween: !error && !!(data as Decor | null)?.halloween };
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
  const [mounted, setMounted] = useState(false);
  const [flock, setFlock] = useState(false);
  const on = !!decor?.halloween;

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
