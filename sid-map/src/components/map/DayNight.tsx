'use client';

import { useEffect, useState } from 'react';

/**
 * Cycle jour/nuit (Lot 60) : la carte suit l'heure de Paris. Aube rosée,
 * plein jour, crépuscule orangé puis nuit bleue où les lieux s'allument
 * comme des lanternes. Un bouton à côté des calques l'éteint (choix gardé
 * sur l'appareil).
 */

type Key = { h: number; c: [number, number, number]; a: number };
// Teinte posée en « produit » sur la carte (les lieux restent au-dessus).
const KEYS: Key[] = [
  { h: 0, c: [38, 52, 112], a: 0.62 },
  { h: 4.5, c: [38, 52, 112], a: 0.62 },
  { h: 6, c: [214, 120, 128], a: 0.32 },
  { h: 7.5, c: [255, 200, 150], a: 0.12 },
  { h: 9, c: [255, 255, 255], a: 0 },
  { h: 17, c: [255, 255, 255], a: 0 },
  { h: 18.5, c: [255, 170, 100], a: 0.16 },
  { h: 20, c: [196, 92, 110], a: 0.34 },
  { h: 21.5, c: [38, 52, 112], a: 0.58 },
  { h: 24, c: [38, 52, 112], a: 0.62 }
];

export type Sky = { tint: string; opacity: number; night: boolean; phase: string; time: string };

function parisHour(d = new Date()) {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const h = Number(p.find((x) => x.type === 'hour')?.value ?? 0);
  const m = Number(p.find((x) => x.type === 'minute')?.value ?? 0);
  return { value: h + m / 60, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

export function skyAt(hour: number, time = ''): Sky {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = b.h === a.h ? 0 : (hour - a.h) / (b.h - a.h);
  const c = a.c.map((v, k) => Math.round(v + (b.c[k] - v) * t));
  const phase =
    hour < 5 || hour >= 21.5 ? 'Nuit' : hour < 7.5 ? 'Aube' : hour < 12 ? 'Matin' : hour < 18 ? 'Après-midi' : hour < 20 ? 'Fin du jour' : 'Crépuscule';
  return { tint: `rgb(${c.join(',')})`, opacity: a.a + (b.a - a.a) * t, night: hour < 6 || hour >= 20.5, phase, time };
}

const KEY = 'sid-map-daynight';

/** L'état du ciel, mis à jour chaque minute. `on` : le calque est affiché. */
export function useSky() {
  const [on, setOn] = useState(true);
  const [sky, setSky] = useState<Sky | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'off') setOn(false);
    } catch {
      /* stockage indisponible */
    }
    const tick = () => {
      const { value, time } = parisHour();
      setSky(skyAt(value, time));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  function toggle() {
    setOn((v) => {
      try {
        localStorage.setItem(KEY, v ? 'off' : 'on');
      } catch {
        /* stockage indisponible */
      }
      return !v;
    });
  }

  return { on, sky, toggle, active: on && !!sky && sky.opacity > 0.01 };
}

/** Calque teinté, à placer dans la carte juste avant les lieux. */
export function NightLayer({ sky, world }: { sky: Sky; world: number }) {
  if (sky.opacity <= 0.01) return null;
  const m = world * 0.06;
  return (
    <rect
      x={-m}
      y={-m}
      width={world + 2 * m}
      height={world + 2 * m}
      fill={sky.tint}
      opacity={sky.opacity}
      style={{ mixBlendMode: 'multiply', pointerEvents: 'none', transition: 'opacity 2s, fill 2s' }}
    />
  );
}

/** Bouton du calque, avec l'heure de Paris et un soleil ou une lune. */
export function SkyButton({ on, sky, onToggle, className }: { on: boolean; sky: Sky | null; onToggle: () => void; className: string }) {
  if (!sky) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={`Cycle jour/nuit à l'heure de Paris — ${sky.phase.toLowerCase()} (${sky.time})`}
      className={className}
    >
      <svg viewBox="0 0 16 16" width="1.15em" height="1.15em" aria-hidden style={{ display: 'inline-block', verticalAlign: '-0.2em' }}>
        {sky.night ? (
          <path d="M10.8 2.2a6 6 0 1 0 3 8.9 5 5 0 0 1-3-8.9z" fill="#f2e3b0" stroke="#2e261d" strokeWidth="0.8" />
        ) : (
          <g stroke="#e9a93a" strokeWidth="1.3" strokeLinecap="round">
            <circle cx="8" cy="8" r="3.2" fill="#f6cf5a" stroke="#2e261d" strokeWidth="0.8" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <line key={a} x1="8" y1="1.3" x2="8" y2="2.9" transform={`rotate(${a} 8 8)`} />
            ))}
          </g>
        )}
      </svg>{' '}
      {sky.time}
    </button>
  );
}
