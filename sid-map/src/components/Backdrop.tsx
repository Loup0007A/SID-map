/**
 * Fond de la Cartographie (Lot 92) : couleur, halos et motif du thème
 * (classe .fond, fonds.css), puis la poussière dorée qui flotte. Les évents
 * changent le thème (html[data-theme], voir EventDecor et getFondTheme).
 */
const N = 26;

function suite(i: number) {
  const x = Math.sin(i * 9.17 + 1.3) * 31871.917;
  return x - Math.floor(x);
}

const ITEMS = Array.from({ length: N }, (_, i) => ({
  left: `${(suite(i) * 100).toFixed(1)}%`,
  s: `${(4 + suite(i + 40) * 9).toFixed(1)}px`,
  t: `${(22 + suite(i + 80) * 18).toFixed(1)}s`,
  dl: `${(-suite(i + 120) * 40).toFixed(1)}s`,
  dx: `${Math.round(14 + suite(i + 160) * 40)}px`,
  k: `var(--p${(i % 4) + 1})`,
}));

export default function Backdrop() {
  return (
    <>
      <div aria-hidden className="fond" />
      <div aria-hidden className="fond-particules">
        {ITEMS.map((it, i) => (
          <i key={i} style={{ left: it.left, '--s': it.s, '--t': it.t, '--dl': it.dl, '--dx': it.dx, '--k': it.k } as React.CSSProperties} />
        ))}
      </div>
    </>
  );
}
