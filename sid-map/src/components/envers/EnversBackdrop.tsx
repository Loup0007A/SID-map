'use client';

/**
 * Le verso de la feuille (L'Envers) : une nuit d'encre où transparaît, à
 * l'envers, ce qui est tracé de l'autre côté (quadrillage, rose des vents,
 * lettres en miroir), avec des points d'argent comme des piqûres
 * d'épingle dans le papier.
 */

const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  return { x: r(1) * 100, y: r(2) * 100, s: 0.6 + r(3) * 1.6, o: 0.25 + r(4) * 0.6, d: r(5) * 6 };
});

export default function EnversBackdrop({ className = '' }: { className?: string }) {
  return (
    <div className={`envers-backdrop ${className}`} aria-hidden>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
        <defs>
          <pattern id="envers-grid" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="scale(-1 1)">
            <path d="M8 0H0V8" fill="none" stroke="#c9d3e6" strokeWidth="0.06" strokeOpacity="0.16" />
          </pattern>
          <radialGradient id="envers-glow" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#3a2f63" stopOpacity="0.55" />
            <stop offset="0.6" stopColor="#140f26" stopOpacity="0.2" />
            <stop offset="1" stopColor="#05040b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#envers-glow)" />
        <rect width="100" height="100" fill="url(#envers-grid)" />
        {/* Côtes devinées par transparence, en miroir. */}
        <g transform="translate(100 0) scale(-1 1)" fill="none" stroke="#b9a77a" strokeOpacity="0.13" strokeWidth="0.18">
          <path d="M6 30c6-6 12-4 17-8s9-11 17-9 9 9 16 10 14-6 20-2 6 10 12 12" />
          <path d="M10 72c5-5 10-2 15-6s7-10 14-9 10 8 17 7 10-7 17-5 8 9 15 9" />
          <path d="M58 40c4 2 6 7 4 11s-8 5-11 2-3-9 0-12 4-2 7-1z" />
        </g>
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.s * 0.12}
            fill="#dfe6f2"
            opacity={s.o}
            className={i % 6 === 0 ? 'envers-star' : undefined}
            style={i % 6 === 0 ? { animationDelay: `${s.d}s` } : undefined}
          />
        ))}
      </svg>
      {/* Rose des vents de l'autre côté : en miroir, qui tourne très lentement. */}
      <svg className="envers-rose" viewBox="-50 -50 100 100">
        <g fill="none" stroke="#d9c58f" strokeOpacity="0.22" strokeWidth="0.35" transform="scale(-1 1)">
          <circle r="46" />
          <circle r="43" strokeDasharray="0.6 1.4" />
          <circle r="30" strokeOpacity="0.14" />
          {Array.from({ length: 32 }, (_, i) => (
            <line key={i} x1="0" y1="-43" x2="0" y2={i % 4 === 0 ? -38 : -41} transform={`rotate(${i * 11.25})`} />
          ))}
          <path d="M0-40 4-4 0 0-4-4zM0 40 4 4 0 0-4 4zM-40 0-4-4 0 0-4 4zM40 0 4-4 0 0 4 4z" fill="#d9c58f" fillOpacity="0.06" />
          <path d="M0-26 2.5-2.5 0 0-2.5-2.5z" transform="rotate(45)" />
          <path d="M0-26 2.5-2.5 0 0-2.5-2.5z" transform="rotate(135)" />
          <path d="M0-26 2.5-2.5 0 0-2.5-2.5z" transform="rotate(225)" />
          <path d="M0-26 2.5-2.5 0 0-2.5-2.5z" transform="rotate(315)" />
          <text y="-47.5" fontSize="4" textAnchor="middle" fill="#d9c58f" fillOpacity="0.3" stroke="none" fontFamily="Alegreya SC, serif">N</text>
        </g>
      </svg>
      <div className="envers-mirror-word">L’Envers</div>
    </div>
  );
}
