/**
 * Fond animé : vagues bleues transparentes sur fond noir + bulles.
 * 100 % CSS (aucun JS côté navigateur). Désactivé si l'utilisateur demande moins de mouvement.
 */
const W = 1440;

function wave(h: number, amp: number, periods: number, phase: number, closed: boolean) {
  const steps = periods * 14;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * W;
    const y = h * 0.5 + Math.sin((i / steps) * periods * Math.PI * 2 + phase) * amp;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return closed ? `${d}L${W} ${h} L0 ${h} Z` : d;
}

type Layer = {
  h: number;
  amp: number;
  periods: number;
  phase: number;
  dur: number;
  rev?: boolean;
  fill: string;
  crest: string;
  bottom: number;
  desktopOnly?: boolean;
};

const LAYERS: Layer[] = [
  { h: 260, amp: 30, periods: 2, phase: 0.4, dur: 62, fill: 'rgba(32,96,200,0.10)', crest: 'rgba(120,190,255,0.20)', bottom: 40, desktopOnly: true },
  { h: 240, amp: 26, periods: 3, phase: 2.1, dur: 48, rev: true, fill: 'rgba(40,120,225,0.12)', crest: 'rgba(130,200,255,0.26)', bottom: 10 },
  { h: 210, amp: 22, periods: 2, phase: 4.2, dur: 38, fill: 'rgba(60,150,240,0.14)', crest: 'rgba(150,210,255,0.32)', bottom: -20 },
  { h: 180, amp: 18, periods: 3, phase: 1.0, dur: 28, rev: true, fill: 'rgba(90,175,250,0.16)', crest: 'rgba(180,225,255,0.40)', bottom: -40, desktopOnly: true },
];

const BUBBLES = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 4 + ((i * 5) % 11),
  dur: 16 + ((i * 3) % 14),
  delay: -((i * 2.7) % 24),
}));

export default function Waves() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(30,90,180,0.35), transparent 60%), radial-gradient(ellipse 60% 40% at 95% 100%, rgba(20,70,160,0.30), transparent 60%), linear-gradient(180deg, #050912 0%, #04070f 55%, #030610 100%)',
      }}
    >
      {LAYERS.map((l, i) => (
        <div
          key={i}
          className={`wave-layer absolute left-0 w-[200%] will-change-transform ${l.desktopOnly ? 'hidden md:block' : ''}`}
          style={{
            bottom: l.bottom,
            height: l.h,
            animation: `${l.rev ? 'wave-slide-rev' : 'wave-slide'} ${l.dur}s linear infinite`,
          }}
        >
          <div className="flex h-full w-full">
            {[0, 1].map((k) => (
              <svg key={k} className="h-full w-1/2" viewBox={`0 0 ${W} ${l.h}`} preserveAspectRatio="none">
                <path d={wave(l.h, l.amp, l.periods, l.phase, true)} fill={l.fill} />
                <path d={wave(l.h, l.amp, l.periods, l.phase, false)} fill="none" stroke={l.crest} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </svg>
            ))}
          </div>
        </div>
      ))}

      <div className="hidden md:block">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="bubble absolute rounded-full"
            style={{
              left: `${b.left}%`,
              bottom: -24,
              width: b.size,
              height: b.size,
              border: '1px solid rgba(150,210,255,0.35)',
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), rgba(124,195,238,0.04))',
              animation: `bubble-rise ${b.dur}s ease-in infinite`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
