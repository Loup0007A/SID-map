/**
 * Dessins des fêtes partagés avec le Dossier Central (Lot 49) : petites
 * particules (cœurs, notes, clochettes…), bleuet, brin de muguet, colombe et
 * pigeon. Mêmes dessins que sur le Dossier Central.
 */

export type MiniKind =
  | "heart"
  | "heartLine"
  | "note"
  | "notes"
  | "noteQuarter"
  | "noteBeam"
  | "blossom"
  | "petal"
  | "sakura"
  | "bubble"
  | "bell"
  | "snow"
  | "snowStar"
  | "sparkle"
  | "dot"
  | "bleuet"
  | "leaf";

const HEART = "M0 9.4 C-6.4 4.8 -10.4 1.2 -10.4 -3.6 C-10.4 -7.2 -7.7 -9.8 -4.7 -9.8 C-2.7 -9.8 -1 -8.7 0 -6.9 C1 -8.7 2.7 -9.8 4.7 -9.8 C7.7 -9.8 10.4 -7.2 10.4 -3.6 C10.4 1.2 6.4 4.8 0 9.4 Z";

function art(kind: MiniKind) {
  switch (kind) {
    case "heart":
      return (
        <>
          <path d={HEART} fill="currentColor" />
          <path d="M0 9.4 C4.6 6 8.8 2.6 10 -1.8 C8.4 2.2 4.6 5 0.6 6.6 Z" fill="#000" opacity="0.16" />
          <ellipse cx="-5" cy="-4.8" rx="2.6" ry="1.5" transform="rotate(-38 -5 -4.8)" fill="#fff" opacity="0.75" />
          <circle cx="-7.2" cy="-1.6" r="0.9" fill="#fff" opacity="0.55" />
        </>
      );
    case "heartLine":
      return (
        <>
          <path d={HEART} fill="currentColor" opacity="0.18" />
          <path d={HEART} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M-6.8 -4.6 C-6.2 -6.6 -4.6 -7.4 -3.2 -7.2" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
        </>
      );
    case "note":
      return (
        <>
          <ellipse cx="-3.4" cy="6.4" rx="4.4" ry="3.2" transform="rotate(-22 -3.4 6.4)" fill="currentColor" />
          <path d="M0 5.6 V-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M0 -10 C3.4 -8.4 7.6 -6 6.4 -0.6 C6 -3.8 3.6 -5.2 0 -5.6 Z" fill="currentColor" />
          <ellipse cx="-4.6" cy="5.4" rx="1.4" ry="0.8" transform="rotate(-22 -4.6 5.4)" fill="#fff" opacity="0.7" />
        </>
      );
    case "notes":
      return (
        <>
          <ellipse cx="-6.4" cy="7" rx="3.8" ry="2.8" transform="rotate(-22 -6.4 7)" fill="currentColor" />
          <ellipse cx="5.2" cy="4.4" rx="3.8" ry="2.8" transform="rotate(-22 5.2 4.4)" fill="currentColor" />
          <path d="M-3.4 6.2 V-7 M8.2 3.6 V-9.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M-4.3 -7.4 L9.1 -10.2 L9.1 -6.4 L-4.3 -3.6 Z" fill="currentColor" />
          <ellipse cx="-7.4" cy="6.2" rx="1.2" ry="0.7" transform="rotate(-22 -7.4 6.2)" fill="#fff" opacity="0.7" />
          <ellipse cx="4.2" cy="3.6" rx="1.2" ry="0.7" transform="rotate(-22 4.2 3.6)" fill="#fff" opacity="0.7" />
        </>
      );
    case "noteBeam":
      return (
        <>
          <ellipse cx="-6.4" cy="7" rx="3.8" ry="2.8" transform="rotate(-22 -6.4 7)" fill="currentColor" />
          <ellipse cx="5.2" cy="4.4" rx="3.8" ry="2.8" transform="rotate(-22 5.2 4.4)" fill="currentColor" />
          <path d="M-3.4 6.2 V-7 M8.2 3.6 V-9.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <path d="M-4.3 -7.4 L9.1 -10.2 L9.1 -7.6 L-4.3 -4.8 Z M-4.3 -2.8 L9.1 -5.6 L9.1 -3 L-4.3 -0.2 Z" fill="currentColor" />
        </>
      );
    case "noteQuarter":
      return (
        <>
          <ellipse cx="-2.4" cy="6.4" rx="4.4" ry="3.2" transform="rotate(-22 -2.4 6.4)" fill="currentColor" />
          <path d="M1 5.6 V-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="-3.6" cy="5.4" rx="1.4" ry="0.8" transform="rotate(-22 -3.6 5.4)" fill="#fff" opacity="0.7" />
        </>
      );
    case "blossom":
      return (
        <>
          {[0, 72, 144, 216, 288].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <path d="M0 -1.5 C-4.4 -3 -5.4 -8 -3 -10.4 C-1.8 -11.2 -0.8 -10.4 0 -9.4 C0.8 -10.4 1.8 -11.2 3 -10.4 C5.4 -8 4.4 -3 0 -1.5 Z" fill="currentColor" />
              <path d="M0 -2.4 V-8" stroke="#fff" strokeWidth="0.7" opacity="0.55" strokeLinecap="round" />
            </g>
          ))}
          <circle r="2.6" fill="#ffd65a" />
          <circle r="1.1" fill="#e89a2a" />
        </>
      );
    case "petal":
      return (
        <>
          <path d="M0 -10 C5.6 -6 6.4 3.6 0 10 C-6.4 3.6 -5.6 -6 0 -10 Z" fill="currentColor" />
          <path d="M0 -7 C1.2 -2 1.2 3 0 8" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.6" strokeLinecap="round" />
          <path d="M0 10 C4.4 5.6 5.8 0 4.6 -4.6 C5.2 1.2 3.4 6 0 10 Z" fill="#000" opacity="0.1" />
        </>
      );
    case "sakura":
      return (
        <>
          <path d="M0 10 C-6.4 4 -6.6 -4 -3 -9.8 L-1.2 -7.4 L0 -9.6 L1.2 -7.4 L3 -9.8 C6.6 -4 6.4 4 0 10 Z" fill="currentColor" />
          <path d="M0 -6 V7" stroke="#fff" strokeWidth="0.8" opacity="0.55" strokeLinecap="round" />
          <ellipse cx="-2.6" cy="-2" rx="1.2" ry="2.6" fill="#fff" opacity="0.35" />
        </>
      );
    case "bubble":
      return (
        <>
          <circle r="8.6" fill="currentColor" opacity="0.14" />
          <circle r="8.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M-5.6 -2.4 A6 6 0 0 1 -1.6 -6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          <circle cx="3.6" cy="4" r="1" fill="#fff" opacity="0.5" />
        </>
      );
    case "bell":
      return (
        <>
          <path d="M0 -10 Q2.6 -10 3 -7" fill="none" stroke="#5fae6e" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M0 -7 C-4.6 -7 -6 -2.6 -6 1.4 L-7.4 4.6 L-4.6 3.6 L-2.4 5.6 L0 4 L2.4 5.6 L4.6 3.6 L7.4 4.6 L6 1.4 C6 -2.6 4.6 -7 0 -7 Z" fill="currentColor" />
          <path d="M2.2 -5.6 C4.6 -4 5 -1 5 1.6 L7.4 4.6 L4.6 3.6 C4.8 1 4.4 -3 2.2 -5.6 Z" fill="#000" opacity="0.1" />
          <ellipse cx="-2.6" cy="-2.4" rx="1.1" ry="2.2" fill="#fff" opacity="0.8" />
        </>
      );
    case "snow":
      return (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
          {[0, 60, 120].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 -10 V10 M-2.8 -8 L0 -5.4 L2.8 -8 M-2.8 8 L0 5.4 L2.8 8 M-2 -3.4 L0 -1.8 L2 -3.4 M-2 3.4 L0 1.8 L2 3.4" />
          ))}
        </g>
      );
    case "snowStar":
      return (
        <>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 -1 L-1.8 -5 L0 -10.4 L1.8 -5 Z" fill="currentColor" />
          ))}
          <circle r="1.8" fill="#fff" opacity="0.8" />
        </>
      );
    case "sparkle":
      return (
        <>
          <path d="M0 -10.4 C1 -3.4 3.4 -1 10.4 0 C3.4 1 1 3.4 0 10.4 C-1 3.4 -3.4 1 -10.4 0 C-3.4 -1 -1 -3.4 0 -10.4 Z" fill="currentColor" />
          <circle r="1.6" fill="#fff" opacity="0.85" />
        </>
      );
    case "dot":
      return (
        <>
          <circle r="4" fill="currentColor" />
          <circle cx="-1.3" cy="-1.3" r="1.2" fill="#fff" opacity="0.6" />
        </>
      );
    case "bleuet":
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} transform={`rotate(${i * 45})`} d="M-1.2 -2.6 L-3.8 -8.6 L-2.6 -10 L-1.4 -8.8 L0 -10.6 L1.4 -8.8 L2.6 -10 L3.8 -8.6 L1.2 -2.6 Z" fill="currentColor" />
          ))}
          <circle r="2.8" fill="#2b2366" />
          <circle cx="-0.8" cy="-0.8" r="0.8" fill="#9b80f0" />
        </>
      );
    case "leaf":
      return (
        <>
          <path d="M-8 8 C-9 -2 -2 -9 9 -9 C9 2 2 9 -8 8 Z" fill="currentColor" />
          <path d="M-8 8 C-3 3 2 -2 7 -7" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.5" strokeLinecap="round" />
        </>
      );
  }
}

/** Le même dessin, en groupe SVG (dans un autre dessin) : `size` en unités du dessin parent. */
export function MiniArt({ kind, size = 24, x = 0, y = 0, color, className }: { kind: MiniKind; size?: number; x?: number; y?: number; color?: string; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${(size / 24).toFixed(3)})`} style={color ? { color } : undefined} className={className}>
      {art(kind)}
    </g>
  );
}

/** Tête de bleuet : fleurons dentelés sur deux rangs, cœur sombre aux étamines violettes. */
export function BleuetHead() {
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 40})`}>
          <path d="M-1.8 -4.2 L-6.4 -15.4 L-5 -17.8 L-3.4 -16 L-2 -18.8 L-0.4 -16.6 L1.2 -19 L2.6 -16.2 L4.4 -17.6 L5.6 -15 L1.8 -4.2 Z" fill="#3b69e3" />
          <path d="M-0.9 -5 L-3.4 -14.2 L0 -13 L3 -14.4 L0.9 -5 Z" fill="#2147b5" opacity="0.55" />
          <path d="M-5 -16.8 L-3.4 -16 L-2 -18.8 L-0.4 -16.6 L1.2 -19 L2.6 -16.2 L4.4 -17.6" fill="none" stroke="#86a8ff" strokeWidth="0.7" strokeLinejoin="round" />
        </g>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <path key={`b${i}`} transform={`rotate(${i * 40 + 20})`} d="M-1.2 -3.6 L-3.6 -10.4 L-2.2 -11.6 L-1 -10.6 L0 -12.2 L1 -10.6 L2.2 -11.6 L3.6 -10.4 L1.2 -3.6 Z" fill="#5c80f0" />
      ))}
      <circle r="4.6" fill="#2a2266" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <circle key={`s${i}`} cx={(Math.cos(a) * 2.8).toFixed(2)} cy={(Math.sin(a) * 2.8).toFixed(2)} r="0.95" fill="#9b80f0" />;
      })}
      <circle r="1.1" fill="#c8b6ff" />
    </>
  );
}

/** Clochette de muguet (posée sous sa petite tige, origine en haut). */
function Clochette({ x, y, s, flip = false }: { x: number; y: number; s: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M0 0 C-3.4 0 -4.4 2.8 -4.4 5 L-5.2 6.8 L-3.4 6.1 L-1.8 7.2 L0 6.3 L1.8 7.2 L3.4 6.1 L5.2 6.8 L4.4 5 C4.4 2.8 3.4 0 0 0 Z" fill="#fdfff8" />
      <path d="M1.4 0.6 C3.2 1.4 3.8 3.4 3.8 5.2 L5.2 6.8 L3.4 6.1 C3.4 4 3 2 1.4 0.6 Z" fill="#d5e4cd" />
      <ellipse cx="-1.8" cy="2.6" rx="0.8" ry="1.5" fill="#fff" />
    </g>
  );
}

export function MuguetSprig({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  const bells: [number, number, number][] = [
    [30.6, 14.6, 0.62],
    [29, 20.4, 0.76],
    [27.4, 26.6, 0.86],
    [25.9, 33, 0.94],
    [24.7, 39.6, 1],
    [23.8, 46.4, 1.04],
  ];
  return (
    <svg viewBox="0 0 44 64" className={className} style={style} aria-hidden>
      {/* Feuilles larges, nervure claire */}
      <path d="M10.6 64 C1.6 50 2.4 26 14.6 7.6 C16.4 5.6 18.6 6.6 17.6 9.6 C11.4 26 12.2 46 16.6 64 Z" fill="#2c844b" />
      <path d="M13 64 C8.6 50 9 30 15.8 9 C11.4 26 12.4 46 16.6 64 Z" fill="#3b9d5b" />
      <path d="M13.4 62 C9.6 46 10.6 28 16 10.6" fill="none" stroke="#7cc98d" strokeWidth="0.7" opacity="0.7" />
      <path d="M35 64 C43 50 41 28 30.6 13.6 C28.8 11.8 26.8 13 27.8 15.8 C33.4 30 33 46 28.6 64 Z" fill="#37a05c" />
      <path d="M32.6 64 C37.4 50 36.4 32 29.4 15.4 C33.4 30 33 46 28.6 64 Z" fill="#2c8a4e" />
      <path d="M31.4 62 C34.6 48 34 32 29.2 17" fill="none" stroke="#86d297" strokeWidth="0.7" opacity="0.6" />
      {/* Hampe et clochettes */}
      <path d="M21.6 64 C20.6 46 22.6 28 32 10" fill="none" stroke="#6bb979" strokeWidth="1.4" strokeLinecap="round" />
      {bells.map(([x, y, s], i) => (
        <g key={i}>
          <path d={`M${x - 2.2} ${y - 1.6} Q${x + 1.6} ${y - 2.8} ${x + 3} ${y + 0.6}`} fill="none" stroke="#6bb979" strokeWidth="0.8" strokeLinecap="round" />
          <Clochette x={x + 3} y={y + 0.4} s={s} />
        </g>
      ))}
      <ellipse cx="32.6" cy="9.4" rx="1.6" ry="2.2" fill="#a9dcae" />
    </svg>
  );
}

type BirdKind = "dove" | "pigeon";
const WING = "M90 44 C92 32 88 21 80 13 C72 7 60 3 46 2.6 C51 5.6 53.4 7.6 52.4 10.2 C46 10.6 40 12.6 35.4 16.4 C43 16.6 47 18.4 47.6 20.6 C41.6 22.4 37.6 26 35.4 30.4 C43.4 28.6 49.4 30 52 32.4 C48.4 35.6 46.4 39.6 46 44.4 C56 42.4 64 44 70 48.4 C78 49 85 47.4 90 44 Z";
const BIRD_COLORS: Record<BirdKind, { body: string; belly: string; wing: string; far: string; line: string; tail: string; beak: string; eye: string }> = {
  dove: { body: "#f8fafd", belly: "#dfe6f1", wing: "#ffffff", far: "#d2dae8", line: "#c6d0e2", tail: "#e7ecf4", beak: "#e2a07e", eye: "#1b1b24" },
  pigeon: { body: "#aab4c6", belly: "#939db0", wing: "#bcc5d4", far: "#8b95a8", line: "#7d879b", tail: "#9aa4b7", beak: "#3c3c48", eye: "#ff8a3a" },
};

/**
 * Colombe (ou pigeon) en vol, vue de profil et tournée vers la droite :
 * queue en éventail, ailes aux rémiges découpées (elles battent : classe
 * `hy-wing`), œil brillant, et ce qu'elle porte dans le bec.
 */
export function Bird({ kind = "dove", carry = "olive", svgClass = "hy-fly-art", className = "hy-bird", wingClass = "hy-wing" }: { kind?: BirdKind; carry?: "olive" | "muguet" | null; svgClass?: string; className?: string; wingClass?: string }) {
  const c = BIRD_COLORS[kind];
  return (
    <svg viewBox="0 -6 142 90" className={svgClass} aria-hidden>
      <g className={className}>
        {/* Aile du fond */}
        <g className={wingClass}>
          <path transform="translate(10 -4) rotate(4 90 44)" d={WING} fill={c.far} />
        </g>
        {/* Queue en éventail */}
        <path d="M46 47 C34 44 20 39 7 38 C9.6 43 11 47 9 52 C11 54.6 12 56 10 60 C22 60 36 57 48 54 Z" fill={c.tail} />
        <path d="M10 45 C22 46.4 33 47.6 44 49 M11 52.6 C22 52.6 33 52.2 44 51.6" fill="none" stroke={c.line} strokeWidth="0.9" strokeLinecap="round" />
        {kind === "pigeon" && <path d="M7 38 C9.6 43 11 47 9 52 C11 54.6 12 56 10 60 L16 59.6 C17.6 52 17 45 14 38.4 Z" fill="#4c5568" />}
        {/* Corps */}
        <path d="M42 50 C48 40 62 36 78 38 C86 38.4 92 34.6 96 30.6 C100 26.4 108 26 112 30 C115.4 33.4 115 38.6 111.6 41.6 C107.4 46 101.4 50 95.4 54 C83 62.4 61 64.4 47 58.4 C43.6 56.8 41.6 53.6 42 50 Z" fill={c.body} />
        <path d="M48 58.4 C62 63.6 82 61.6 95.4 54 C89 60.6 77 64.6 63 64.6 C55 64.6 50.4 62.4 48 58.4 Z" fill={c.belly} />
        {kind === "pigeon" && (
          <>
            <path d="M97 33.6 C99.6 37 100.6 40.6 99.6 44.4 C102.4 42.6 105 40.4 106.6 38.4 C103.6 37.4 100.4 36 98.4 32 Z" fill="#5db58b" opacity="0.75" />
            <path d="M98.6 40.6 C100.4 42.4 100.8 44.2 99.8 46.2 C102 45 103.8 43.6 104.8 42.2 C102.6 42 100.6 41.4 98.6 40.6 Z" fill="#a679d6" opacity="0.7" />
          </>
        )}
        {/* Tête */}
        <circle cx="106.6" cy="31.2" r="2.6" fill={kind === "pigeon" ? "#ffd2a8" : "#e8edf5"} />
        <circle cx="106.6" cy="31.2" r="1.7" fill={c.eye} />
        <circle cx="106" cy="30.5" r="0.6" fill="#fff" />
        <path d="M113.2 32.4 L121.4 34.6 L113.4 37.4 Z" fill={c.beak} />
        <path d="M112.6 32 C114 31.4 115.4 32 115.8 33.2" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
        {/* Aile de devant : couvertures puis rémiges découpées */}
        <g className={wingClass}>
        <path
          d={WING}
          fill={c.wing}
        />
        <g fill="none" stroke={c.line} strokeWidth="1" strokeLinecap="round">
          <path d="M86 30.6 C76 24 64 22 51 24.4" />
          <path d="M79 14.4 C68 10 58 7.6 49 6 M77 19 C66 16.4 54 16 42 16.6 M75 25 C65 25 55 26.4 42 28.6 M73 33 C65 34.6 58 37 51 40.6" opacity="0.85" />
          {kind === "pigeon" && <path d="M82 36 C74 34 66 34 58 36 M80 41 C72 39.6 64 40 56 42" stroke="#3e4658" strokeWidth="2.2" />}
        </g>
        </g>
        {/* Ce qu'elle porte */}
        {carry === "olive" && (
          <g>
            <path d="M115.6 35.6 C121 38.6 127 39.4 135 45.6" fill="none" stroke="#6b7f3a" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="121.6" cy="33.6" rx="5.4" ry="1.9" transform="rotate(-24 121.6 33.6)" fill="#93b85c" />
            <ellipse cx="127" cy="43.6" rx="5.2" ry="1.8" transform="rotate(34 127 43.6)" fill="#7ca24a" />
            <ellipse cx="131" cy="38.6" rx="5" ry="1.7" transform="rotate(-14 131 38.6)" fill="#8fb35a" />
            <ellipse cx="136.6" cy="49.6" rx="4.6" ry="1.6" transform="rotate(48 136.6 49.6)" fill="#7ca24a" />
            <path d="M119 36 L121.6 33.6 M126.6 40.6 L127 43.6 M130.4 42.6 L131 38.6" stroke="#6b7f3a" strokeWidth="0.8" />
            <circle cx="124.6" cy="44.4" r="1.9" fill="#4b5e2b" />
            <circle cx="132.6" cy="46.6" r="1.7" fill="#56692f" />
            <circle cx="124" cy="43.8" r="0.5" fill="#fff" opacity="0.6" />
          </g>
        )}
        {carry === "muguet" && (
          <g transform="translate(116 33) rotate(24) scale(0.56)">
            <path d="M0 4 C8 6 16 8 26 4" fill="none" stroke="#6bb979" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M6 6 C4 14 8 22 14 26 C12 18 12 12 10 6 Z" fill="#37a05c" />
            {[[12, 5.6, 1], [18, 6.4, 1.08], [24, 5, 0.9]].map(([x, y, s], i) => (
              <g key={i}>
                <path d={`M${x} ${y} q1 2 1 4`} fill="none" stroke="#6bb979" strokeWidth="1.2" />
                <Clochette x={x + 1} y={y + 4} s={s * 1.5} />
              </g>
            ))}
          </g>
        )}
      </g>
    </svg>
  );
}

