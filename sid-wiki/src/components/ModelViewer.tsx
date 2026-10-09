'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  /** Animation à lancer au chargement (nom exact dans le .glb) */
  animation?: string | null;
  /** Appelé avec la liste des animations contenues dans le modèle */
  onAnimations?: (names: string[]) => void;
  /** Affiche le sélecteur d'animation (lecteurs) ; l'éditeur gère le sien */
  showAnimationPicker?: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const MV: any = 'model-viewer';

export default function ModelViewer({ src, animation, onAnimations, showAnimationPicker = true }: Props) {
  const ref = useRef<any>(null);
  const cb = useRef(onAnimations);
  cb.current = onAnimations;

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [anims, setAnims] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(animation ?? null);
  const [playing, setPlaying] = useState(true);
  const [rotate, setRotate] = useState(false);

  useEffect(() => {
    let alive = true;
    import('@google/model-viewer')
      .then(() => alive && setReady(true))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => setCurrent(animation ?? null), [animation]);

  useEffect(() => {
    const el = ref.current;
    if (!ready || !el) return;
    const onLoad = () => {
      const names: string[] = Array.from(el.availableAnimations ?? []);
      setAnims(names);
      cb.current?.(names);
    };
    const onError = () => setFailed(true);
    el.addEventListener('load', onLoad);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('load', onLoad);
      el.removeEventListener('error', onError);
    };
  }, [ready, src]);

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play();
    setPlaying(!playing);
  }

  if (failed) {
    return <p className="rounded-xl bg-white/[0.09] p-4 text-sm text-stamp">Impossible de charger le modèle 3D.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.1] to-sky-400/[0.08] backdrop-blur">
      {ready ? (
        <MV
          ref={ref}
          src={src}
          camera-controls=""
          autoplay=""
          touch-action="pan-y"
          shadow-intensity="1"
          interaction-prompt="auto"
          auto-rotate={rotate ? '' : undefined}
          animation-name={current ?? undefined}
          style={{ width: '100%', height: 'clamp(16rem, 70vw, 22rem)', background: 'transparent', ['--poster-color' as string]: 'transparent' }}
        />
      ) : (
        <div className="flex h-64 items-center justify-center font-typewriter text-olive-700">Chargement du modèle 3D…</div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/15 bg-white/[0.07] p-2 text-sm">
        <button type="button" className="btn-ghost !px-3 !py-0.5" onClick={togglePlay} disabled={!ready}>
          {playing ? '⏸ Pause' : '▶ Lecture'}
        </button>
        <button type="button" className="btn-ghost !px-3 !py-0.5" onClick={() => setRotate((r) => !r)} disabled={!ready}>
          {rotate ? '⏹ Stop rotation' : '🔄 Rotation'}
        </button>
        <button type="button" className="btn-ghost !px-3 !py-0.5" onClick={() => ref.current?.requestFullscreen?.()} disabled={!ready}>
          ⛶ Plein écran
        </button>

        {showAnimationPicker && anims.length > 1 && (
          <select
            className="input !w-auto !rounded-full !py-0.5"
            value={current ?? anims[0]}
            onChange={(e) => {
              setCurrent(e.target.value);
              setPlaying(true);
            }}
            aria-label="Animation"
          >
            {anims.map((a) => (
              <option key={a} value={a}>
                🎬 {a}
              </option>
            ))}
          </select>
        )}
        {ready && anims.length === 0 && <span className="text-olive-700/80">Pas d’animation dans ce modèle — fais-le tourner à la souris !</span>}
      </div>
    </div>
  );
}
