'use client';

/**
 * Élection du Dictateur (Lot 80) sur la Cartographie et le Wiki : fanions
 * pourpre et or sous la barre, confettis, et une étiquette (date de la
 * proclamation, puis le nom de l'élu). La cérémonie elle-même a lieu sur le
 * Dossier Central. Fichier identique dans la Cartographie et le Wiki.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { BRAND } from '@/lib/brand';

type Status = { revealed: boolean; reveal_at: string | null; winner: { nickname: string } | null };

function Flags({ top, width }: { top: number; width: number }) {
  const swag = width < 640 ? 120 : 170;
  const sag = width < 640 ? 6 : 9;
  const per = width < 640 ? 6 : 9;
  const n = Math.ceil(width / swag);
  let wire = 'M0 1';
  const flags: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = i * swag;
    wire += ` Q${x0 + swag / 2} ${1 + sag * 2} ${x0 + swag} 1`;
    for (let k = 1; k <= per; k++) {
      const t = k / (per + 1);
      flags.push({ x: x0 + swag * t, y: 1 + 4 * sag * t * (1 - t), r: (Math.atan((4 * sag * (1 - 2 * t)) / swag) * 180) / Math.PI });
    }
  }
  return (
    <svg className="ev-garland el-garland" style={{ top }} width={width} height={sag * 2 + 24} viewBox={`0 0 ${width} ${sag * 2 + 24}`} aria-hidden>
      <path d={wire} className="el-wire" />
      {flags.map((f, i) => (
        <g key={i} transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.r.toFixed(1)})`}>
          <path d="M-7 1 L7 1 L0 15 Z" className={`el-flag el-flag-${i % 3}`} />
        </g>
      ))}
    </svg>
  );
}

export function ElectionLayer({ variant }: { variant: 'map' | 'wiki' }) {
  const [mounted, setMounted] = useState(false);
  const [bar, setBar] = useState<{ top: number; width: number } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    setMounted(true);
    const measure = () => {
      const el = document.querySelector(variant === 'map' ? 'nav' : 'header');
      setBar({ top: el ? Math.round(el.getBoundingClientRect().bottom) : 0, width: document.documentElement.clientWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    createClient()
      .rpc('election_status')
      .then(({ data, error }) => !error && setStatus(data as Status));
    return () => window.removeEventListener('resize', measure);
  }, [variant]);

  const bits = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return {
          left: `${(r(1) * 100).toFixed(1)}%`,
          animationDelay: `${(-r(2) * 12).toFixed(2)}s`,
          animationDuration: `${(9 + r(3) * 8).toFixed(2)}s`,
          background: ['#f0c27a', '#c8324f', '#f6eedb', '#7a1430', '#ffd86b'][i % 5],
          ['--sway' as string]: `${((r(4) - 0.5) * 140).toFixed(0)}px`,
          ['--spin' as string]: `${Math.round(360 + r(5) * 720)}deg`
        } as CSSProperties;
      }),
    []
  );

  if (!mounted) return null;
  const label = status?.revealed
    ? status.winner
      ? `Vive ${status.winner.nickname}, Dictateur du S.I.D. !`
      : 'Le Conseil du S.I.D. délibère encore…'
    : status?.reveal_at
      ? `Proclamation du Dictateur : ${new Date(status.reveal_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`
      : null;

  return createPortal(
    <>
      <div className={`ev-front ev-${variant}`} aria-hidden>
        {bar && <Flags top={bar.top} width={bar.width} />}
        <div className="el-confetti">
          {bits.map((s, i) => (
            <i key={i} style={s} />
          ))}
        </div>
      </div>
      {label && (
        <a href={`${BRAND.urls.site}/dashboard`} className={`el-pill el-pill-${variant}`}>
          <span aria-hidden>👑</span> {label}
        </a>
      )}
    </>,
    document.body
  );
}
