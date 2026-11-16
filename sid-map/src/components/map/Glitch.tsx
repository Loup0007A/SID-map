'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

/**
 * « Lieu inconnu » (Lot 80, L'Envers) : un membre qui a brouillé sa position
 * apparaît comme un bug de la carte. Texte qui se corrompt façon Matrix, et
 * marqueur qui saute d'un endroit à l'autre.
 */

const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ01#%&@$▓░▒';
const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

/** Texte qui se brouille par à-coups puis se recompose. */
export function GlitchText({ text = 'Lieu inconnu', className = '' }: { text?: string; className?: string }) {
  const still = usePrefersReducedMotion();
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (still) return setShown(text);
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const burst = (left: number) => {
      if (!alive) return;
      if (left <= 0) {
        setShown(text);
        timer = setTimeout(() => burst(4 + Math.floor(Math.random() * 6)), 900 + Math.random() * 1800);
        return;
      }
      const rate = 0.18 + Math.random() * 0.35;
      setShown([...text].map((c) => (c !== ' ' && Math.random() < rate ? glyph() : c)).join(''));
      timer = setTimeout(() => burst(left - 1), 60 + Math.random() * 50);
    };
    burst(5);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [text, still]);

  return (
    <span className={`glitch-text ${className}`} data-text={shown} aria-label={text}>
      <span aria-hidden>{shown}</span>
    </span>
  );
}

/** Marqueur SVG (unités de la carte) : à placer dans un <g transform="translate(x, y)">. */
export function GlitchMarkerArt({ label }: { label?: string }) {
  const still = usePrefersReducedMotion();
  const [cols, setCols] = useState(() => Array.from({ length: 5 }, () => [glyph(), glyph(), glyph()]));

  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setCols((c) => c.map((col) => [glyph(), ...col.slice(0, 2)])), 140);
    return () => clearInterval(id);
  }, [still]);

  return (
    <g className="glitch-marker" aria-label={label ? `${label} : lieu inconnu` : 'Lieu inconnu'}>
      <g className="glitch-marker-shake">
        <rect x={-2.2} y={-2.2} width={4.4} height={4.4} rx={0.4} className="glitch-marker-box" />
        {cols.map((col, i) =>
          col.map((ch, j) => (
            <text key={`${i}-${j}`} x={-1.75 + i * 0.88} y={-1.15 + j * 1.25} className="glitch-marker-rain" opacity={1 - j * 0.3}>
              {ch}
            </text>
          ))
        )}
        <rect x={-2.6} y={-0.5} width={5.2} height={0.35} className="glitch-marker-tear" />
        <rect x={-2.4} y={1} width={3.4} height={0.25} className="glitch-marker-tear glitch-marker-tear--b" />
      </g>
      <text y={4.1} textAnchor="middle" className="glitch-marker-label glitch-marker-label--r">
        LIEU INCONNU
      </text>
      <text y={4.1} textAnchor="middle" className="glitch-marker-label glitch-marker-label--c">
        LIEU INCONNU
      </text>
      <text y={4.1} textAnchor="middle" className="glitch-marker-label">
        LIEU INCONNU
      </text>
      {label && (
        <text y={5.6} textAnchor="middle" className="glitch-marker-name">
          {label}
        </text>
      )}
    </g>
  );
}
