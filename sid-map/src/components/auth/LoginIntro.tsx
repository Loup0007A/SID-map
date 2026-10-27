'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';

/**
 * Animation de connexion de l'Atlas (≈ 1,6 s) : une rose des vents se
 * trace à la plume sur un médaillon de vélin, l'aiguille tourne et trouve
 * le nord, puis la carte s'ouvre.
 */
export default function LoginIntro({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setTimeout(onDone, reduce ? 350 : 1650);
    const sb = createClient();
    sb.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (uid)
        sb.from('profiles')
          .select('nickname')
          .eq('id', uid)
          .maybeSingle()
          .then(({ data: p }) => p?.nickname && setName(p.nickname));
    });
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ticks = Array.from({ length: 32 }, (_, i) => i);

  // Directement sous <body> : rien ne passe par-dessus, rien ne la rogne.
  return createPortal(
    <div className="atlas-intro fixed inset-0 z-[9000] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <svg viewBox="-60 -60 120 120" className="atlas-intro-rose h-44 w-44" aria-hidden>
          <circle r="56" fill="#ece0c2" />
          <circle r="56" fill="none" stroke="#2e261d" strokeWidth="1.2" className="atlas-draw" pathLength={1} />
          <circle r="51" fill="none" stroke="#2e261d" strokeWidth="0.5" strokeDasharray="1.2 1.6" />
          {ticks.map((i) => (
            <line
              key={i}
              x1="0"
              y1="-51"
              x2="0"
              y2={i % 4 === 0 ? -44 : -47.5}
              stroke="#2e261d"
              strokeWidth={i % 4 === 0 ? 0.9 : 0.5}
              transform={`rotate(${i * 11.25})`}
              className="atlas-tick"
              style={{ animationDelay: `${0.15 + i * 0.012}s` }}
            />
          ))}
          <g className="atlas-draw-g">
            <path d="M0-40 6-6 0 0-6-6zM0 40 6 6 0 0-6 6zM-40 0-6-6 0 0-6 6zM40 0 6-6 0 0 6 6z" fill="#d4c39a" stroke="#2e261d" strokeWidth="0.8" pathLength={1} className="atlas-draw" />
            <path d="M0-26 3.5-3.5 0 0-3.5-3.5z" transform="rotate(45)" fill="#2e261d" />
            <path d="M0-26 3.5-3.5 0 0-3.5-3.5z" transform="rotate(135)" fill="#2e261d" />
            <path d="M0-26 3.5-3.5 0 0-3.5-3.5z" transform="rotate(225)" fill="#2e261d" />
            <path d="M0-26 3.5-3.5 0 0-3.5-3.5z" transform="rotate(315)" fill="#2e261d" />
          </g>
          <text y="-30" textAnchor="middle" fontSize="9" fill="#9b3b28" fontFamily="Alegreya SC, serif" className="atlas-n">
            N
          </text>
          <g className="atlas-needle">
            <path d="M0-34 3.2 0 0 4-3.2 0z" fill="#9b3b28" />
            <path d="M0 34 3.2 0 0-4-3.2 0z" fill="#2e261d" />
            <circle r="2.6" fill="#c9a24d" stroke="#2e261d" strokeWidth="0.6" />
          </g>
        </svg>
        <p className="atlas-intro-title font-display text-2xl text-paper">L&apos;Atlas s&apos;ouvre</p>
        <p className="atlas-intro-line text-sm text-paper/60">{name ? `Bon voyage, ${name}.` : 'Bon voyage, agent.'}</p>
      </div>
    </div>,
    document.body
  );
}
