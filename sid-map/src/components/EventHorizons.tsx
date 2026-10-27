'use client';

/**
 * Horizons des fêtes sur le Wiki (Lot 48) : une silhouette de paysage posée
 * sur la mer, derrière le contenu (manoir, village enneigé, toits, phare,
 * clocher, forêt, ville en fête, Paris, monument). Fichier identique dans la
 * Cartographie et le Wiki (seul le Wiki l'affiche).
 */

export type HorizonKind =
  | 'halloween'
  | 'noel'
  | 'saint_valentin'
  | 'poisson_avril'
  | 'paques'
  | 'premier_mai'
  | 'fete_musique'
  | 'quatorze_juillet'
  | 'armistice'
  | 'grande_chasse';

const W = 1600;
const H = 260;
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const f = (n: number) => n.toFixed(1);

function ridge(base: number, amp: number, seed: number, n = 14) {
  const y = (i: number) => base - amp * (0.5 + 0.35 * Math.sin(i * 1.3 + seed) + 0.15 * Math.sin(i * 2.9 + seed * 1.7));
  let d = `M0 ${H} L0 ${f(y(0))}`;
  for (let i = 0; i < n; i++) {
    const x0 = (i / n) * W;
    const x1 = ((i + 1) / n) * W;
    d += ` C${f(x0 + (x1 - x0) / 2)} ${f(y(i))} ${f(x0 + (x1 - x0) / 2)} ${f(y(i + 1))} ${f(x1)} ${f(y(i + 1))}`;
  }
  return `${d} L${W} ${H} Z`;
}
function ridgeY(base: number, amp: number, seed: number, x: number, n = 14) {
  const t = (x / W) * n;
  const i = Math.floor(t);
  const y = (k: number) => base - amp * (0.5 + 0.35 * Math.sin(k * 1.3 + seed) + 0.15 * Math.sin(k * 2.9 + seed * 1.7));
  return y(i) + (y(i + 1) - y(i)) * (t - i);
}

/** Rangée d'immeubles et leurs fenêtres. */
function city(x0: number, x1: number, base: number, seed: number, minH: number, maxH: number, lit = 0.4) {
  let d = '';
  const wins: [number, number, boolean][] = [];
  let x = x0;
  let i = 0;
  while (x < x1) {
    const w = 40 + rnd(i, seed) * 50;
    const h = minH + rnd(i, seed + 1) * (maxH - minH);
    const top = base - h;
    d += `M${f(x)} ${base} L${f(x)} ${f(top)} L${f(x + 5)} ${f(top - 10)} L${f(x + w - 5)} ${f(top - 10)} L${f(x + w)} ${f(top)} L${f(x + w)} ${base} Z `;
    const cols = Math.max(2, Math.floor((w - 10) / 12));
    const rows = Math.max(1, Math.floor((h - 10) / 16));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const k = i * 97 + r * 13 + c;
        if (rnd(k, seed + 5) < lit) wins.push([x + 6 + c * ((w - 12) / cols), top + 6 + r * 16, rnd(k, seed + 6) < 0.08]);
      }
    x += w;
    i++;
  }
  return { d, wins };
}

function Wins({ wins }: { wins: [number, number, boolean][] }) {
  return (
    <g className="hz-win">
      {wins.map(([x, y, b], i) => (
        <rect key={i} x={f(x)} y={f(y)} width="5" height="8" rx="1" className={b ? 'is-blink' : ''} style={b ? { animationDelay: `${(i % 7) * 1.3}s` } : undefined} />
      ))}
    </g>
  );
}

function fir(x: number, y: number, h: number) {
  const w = h * 0.4;
  return `M${f(x)} ${f(y - h)} L${f(x + w * 0.5)} ${f(y - h * 0.55)} L${f(x + w * 0.3)} ${f(y - h * 0.55)} L${f(x + w)} ${f(y)} L${f(x - w)} ${f(y)} L${f(x - w * 0.3)} ${f(y - h * 0.55)} L${f(x - w * 0.5)} ${f(y - h * 0.55)} Z`;
}

function Halloween() {
  const lit = [[-28, -110], [-28, -78], [16, -60], [46, -60], [100, -60], [16, -30], [150, -84]];
  return (
    <>
      <path className="hz-a" d={ridge(190, 60, 1.3)} />
      {/* Réduit pour que la pointe de la tour reste dans le cadre (elle en sortait). */}
      <g transform="translate(1290 172) scale(0.84)">
        <path className="hz-b" d="M-40 0 L-40 -130 L-46 -130 L-20 -186 L6 -130 L0 -130 L0 -80 L70 -120 L140 -80 L140 -104 L134 -104 L156 -152 L178 -104 L172 -104 L172 0 Z M96 -110 L96 -128 L106 -128 L106 -103 Z" />
        <path className="hz-rim" d="M-46 -130 L-20 -186 L6 -130 M0 -80 L70 -120 L140 -80 M134 -104 L156 -152 L178 -104" />
        <path className="hz-vane" d="M-20 -186 L-20 -200 M156 -152 L156 -164" />
        <path className="hz-b" d="M-20 -200 L-10 -196.5 L-20 -193 Z M156 -164 L166 -160.5 L156 -157 Z" />
        {lit.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="10" height="15" rx="5" className={`hz-glow ${i % 2 ? 'is-flicker' : ''}`} style={{ animationDelay: `${i * 0.9}s` }} />
        ))}
        <circle cx="70" cy="-98" r="7" className="hz-glow is-flicker" style={{ animationDelay: '2.2s' }} />
        <path className="hz-door" d="M58 0 L58 -22 Q66 -32 74 -22 L74 0 Z" />
      </g>
      <path className="hz-c" d={ridge(230, 30, 4.2)} />
      <path className="hz-tree" d="M180 230 C184 200 180 176 170 156 M170 156 C160 142 146 136 132 132 M172 170 C188 158 206 154 222 140 M206 154 C214 146 218 136 218 124 M176 196 C160 190 146 188 130 190" />
    </>
  );
}

function Noel() {
  const peaks = [0, 120, 260, 380, 520, 640, 790, 900, 1040, 1180, 1300, 1440, 1600];
  const d = `M0 ${H} ` + peaks.map((x, i) => `L${x} ${i % 2 ? 90 + rnd(i, 1) * 30 : 150 + rnd(i, 2) * 20}`).join(' ') + ` L${W} ${H} Z`;
  const forest: string[] = [];
  for (let i = 0; i < 60; i++) {
    const x = (i / 60) * W + rnd(i, 3) * 20;
    forest.push(fir(x, ridgeY(220, 30, 2.6, x) + 6, 26 + rnd(i, 4) * 26));
  }
  const town = city(1240, 1600, 222, 7, 24, 44, 0.6);
  return (
    <>
      <path className="hz-a" d={d} />
      <path className="hz-snowcap" d={peaks.map((x, i) => (i % 2 ? `M${x - 30} ${f(110 + rnd(i, 1) * 30)} L${x} ${f(90 + rnd(i, 1) * 30)} L${x + 30} ${f(110 + rnd(i, 1) * 30)} L${x + 10} ${f(106 + rnd(i, 1) * 30)} L${x - 8} ${f(114 + rnd(i, 1) * 30)} Z` : '')).join(' ')} />
      <path className="hz-b" d={ridge(220, 30, 2.6)} />
      <path className="hz-c" d={forest.join(' ')} />
      <path className="hz-c" d={town.d} />
      <Wins wins={town.wins} />
      <path className="hz-snow" d={ridge(244, 14, 0.8)} />
    </>
  );
}

function Valentin() {
  const l = city(0, 360, 220, 3, 50, 120);
  const r = city(1240, 1600, 220, 9, 60, 130);
  return (
    <>
      <path className="hz-a" d={city(340, 1260, 216, 21, 20, 60).d} />
      <path className="hz-c" d={l.d + r.d} />
      <Wins wins={[...l.wins, ...r.wins]} />
      <path className="hz-c" d="M480 240 L480 214 Q800 140 1120 214 L1120 240 L1080 240 Q1040 200 980 240 L860 240 Q800 196 740 240 L620 240 Q560 200 520 240 Z" />
      <path className="hz-rail" d="M490 202 Q800 128 1110 202" />
    </>
  );
}

function Avril() {
  return (
    <>
      <path className="hz-a" d={ridge(230, 30, 0.6)} />
      {/* Phare sur son rocher */}
      <g transform="translate(220 232)">
        <path className="hz-c" d="M-80 0 Q-60 -30 -20 -34 Q20 -40 60 -24 Q80 -14 90 0 Z" />
        <path className="hz-c" d="M-14 -34 L-10 -150 L10 -150 L14 -34 Z M-16 -150 L16 -150 L16 -160 L-16 -160 Z M-10 -160 L-10 -176 L10 -176 L10 -160 Z M-12 -176 L0 -188 L12 -176 Z" />
        <path className="hz-stripe" d="M-13 -60 L13 -60 L12 -76 L-12 -76 Z M-11 -104 L11 -104 L10.5 -120 L-10.5 -120 Z" />
        <rect x="-8" y="-174" width="16" height="12" className="hz-glow" />
        <path className="hz-beam" d="M0 -168 L-520 -230 L-520 -110 Z M0 -168 L520 -230 L520 -110 Z" />
      </g>
      {/* Bateau de pêche */}
      <g transform="translate(1360 226)" className="hz-boat">
        <path className="hz-c" d="M-60 0 L60 0 L46 18 L-50 18 Z M-4 0 L-4 -70 L0 -70 L0 0 Z M2 -66 L40 -6 L2 -6 Z M-6 -60 L-34 -8 L-6 -8 Z" />
        <circle cx="0" cy="-74" r="3" className="hz-glow" />
      </g>
    </>
  );
}

function Paques() {
  return (
    <>
      <path className="hz-green-a" d={ridge(200, 60, 1.1)} />
      <g transform={`translate(1320 ${f(ridgeY(200, 60, 1.1, 1320) + 6)})`} className="hz-green-c">
        <path d="M-54 0 L-54 -18 L-42 -28 L-30 -18 L-30 0 Z M-28 0 L-28 -14 L-18 -22 L-8 -14 L-8 0 Z M-6 0 L-6 -56 L0 -74 L6 -56 L6 0 Z M8 0 L8 -20 L20 -30 L32 -20 L32 0 Z" />
      </g>
      <path className="hz-green-b" d={ridge(236, 30, 3.7)} />
      {[120, 260, 1460].map((x, i) => (
        <g key={i} transform={`translate(${x} ${f(ridgeY(236, 30, 3.7, x) + 6)})`}>
          <path className="hz-trunk" d="M0 0 L0 -30 M0 -20 L12 -34 M0 -24 L-10 -36" />
          {Array.from({ length: 6 }, (_, k) => (
            <circle key={k} cx={f((rnd(i * 6 + k, 1) - 0.5) * 50)} cy={f(-38 - rnd(i * 6 + k, 2) * 26)} r={f(10 + rnd(i * 6 + k, 3) * 8)} className={`hz-bloom hz-bloom-${k % 2}`} />
          ))}
        </g>
      ))}
    </>
  );
}

function Muguet() {
  return (
    <>
      <g className="hz-forest-far">
        {Array.from({ length: 22 }, (_, i) => (
          <ellipse key={i} cx={f((i / 21) * W)} cy={f(170 + rnd(i, 1) * 20)} rx={f(60 + rnd(i, 2) * 40)} ry={f(40 + rnd(i, 3) * 20)} />
        ))}
      </g>
      <g className="hz-forest">
        {Array.from({ length: 12 }, (_, i) => {
          const x = (i / 12) * W + rnd(i, 4) * 80;
          return <path key={i} d={`M${f(x - 6)} 260 L${f(x - 4)} 120 L${f(x + 4)} 120 L${f(x + 6)} 260 Z`} />;
        })}
        {Array.from({ length: 16 }, (_, i) => (
          <ellipse key={`c${i}`} cx={f((i / 15) * W)} cy={f(120 + rnd(i, 5) * 20)} rx={f(70 + rnd(i, 6) * 30)} ry={f(34 + rnd(i, 7) * 14)} />
        ))}
      </g>
    </>
  );
}

function Musique() {
  const c = city(0, W, 230, 13, 50, 150, 0.3);
  const pts = Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * W;
    return [x, 70 + Math.sin(((x % 400) / 400) * Math.PI) * 30] as [number, number];
  });
  return (
    <>
      <path className="hz-c" d={c.d} />
      <Wins wins={c.wins} />
      <path className="hz-wire" d={`M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}`} />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={f(x)} cy={f(y + 8)} r="3.6" className={`hz-bulb hz-bulb-${i % 4}`} style={{ animationDelay: `${(i % 7) * 0.35}s` }} />
      ))}
    </>
  );
}

function Juillet() {
  const c = city(0, W, 230, 31, 50, 110, 0.35);
  return (
    <>
      <path className="hz-c" d={c.d} />
      <Wins wins={c.wins} />
      <g transform="translate(1340 230)">
        <path className="hz-c" d="M-50 0 Q-32 -46 -14 -88 L-10 -136 L-5 -200 L-2 -240 L2 -240 L5 -200 L10 -136 L14 -88 Q32 -46 50 0 L34 0 Q18 -36 0 -36 Q-18 -36 -34 0 Z M-22 -88 L22 -88 L22 -94 L-22 -94 Z M-13 -140 L13 -140 L13 -145 L-13 -145 Z" />
        <circle cx="0" cy="-244" r="2.6" className="hz-glow is-flicker" />
      </g>
    </>
  );
}

function Armistice() {
  return (
    <>
      <path className="hz-a" d={ridge(200, 40, 2.1)} />
      <g className="hz-poplars">
        {Array.from({ length: 14 }, (_, i) => {
          const x = 80 + i * 110 + rnd(i, 2) * 30;
          const h = 56 + rnd(i, 3) * 30;
          return <ellipse key={i} cx={f(x)} cy={f(ridgeY(200, 40, 2.1, x) - h / 2 + 4)} rx={f(8 + rnd(i, 4) * 3)} ry={f(h / 2)} />;
        })}
      </g>
      <path className="hz-b" d={ridge(236, 22, 4.4)} />
      <g transform={`translate(1340 ${f(ridgeY(236, 22, 4.4, 1340) + 4)})`}>
        <path className="hz-c" d="M-44 0 L-44 -8 L-34 -8 L-34 -16 L34 -16 L34 -8 L44 -8 L44 0 Z M-10 -16 L-7 -110 L0 -122 L7 -110 L10 -16 Z" />
        <path className="hz-c" d="M60 0 L60 -90" />
        <path className="hz-f0" d="M60 -90 L72 -89 L72 -75 L60 -76 Z" />
        <path className="hz-f1" d="M72 -89 L84 -90 L84 -76 L72 -75 Z" />
        <path className="hz-f2" d="M84 -90 L96 -88 L96 -74 L84 -76 Z" />
      </g>
    </>
  );
}

const ART: Partial<Record<HorizonKind, () => JSX.Element>> = {
  halloween: Halloween,
  noel: Noel,
  saint_valentin: Valentin,
  poisson_avril: Avril,
  paques: Paques,
  premier_mai: Muguet,
  fete_musique: Musique,
  quatorze_juillet: Juillet,
  armistice: Armistice,
};

export function Horizon({ kind }: { kind: HorizonKind }) {
  const Art = ART[kind];
  if (!Art) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMax slice" className={`hz hz-${kind}`} aria-hidden>
      <Art />
    </svg>
  );
}

/** Feux d'artifice du 14 juillet au-dessus de l'horizon. */
export function HorizonFireworks() {
  const bursts = [
    { x: '14%', y: '18%', c: '#5b8bff', d: 0 },
    { x: '72%', y: '12%', c: '#ff4d5a', d: 2.6 },
    { x: '46%', y: '26%', c: '#f4f6ff', d: 4.8 },
    { x: '88%', y: '30%', c: '#ffd36b', d: 6.6 },
  ];
  return (
    <div className="hz-fireworks" aria-hidden>
      {bursts.map((b, i) => (
        <svg key={i} viewBox="-100 -100 200 200" className="hz-burst" style={{ left: b.x, top: b.y, animationDelay: `${b.d}s`, ['--c' as string]: b.c }}>
          {Array.from({ length: 24 }, (_, k) => {
            const a = (k / 24) * Math.PI * 2;
            return <line key={k} x1={f(Math.cos(a) * 16)} y1={f(Math.sin(a) * 16)} x2={f(Math.cos(a) * 76)} y2={f(Math.sin(a) * 76 + 8)} />;
          })}
        </svg>
      ))}
    </div>
  );
}
