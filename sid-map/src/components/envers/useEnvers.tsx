'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import type { Point } from '@/lib/types';

// Rien de tout ça n'est téléchargé tant que la carte n'a pas cédé.
const EnversTear = dynamic(() => import('./EnversTear'), { ssr: false });
const EnversPanel = dynamic(() => import('./EnversPanel'), { ssr: false });

const SEEN_KEY = 'sid-envers';
const CLICKS = 5;
const SAME_SPOT_PX = 16; // les cinq clics doivent tomber au même endroit
const MAX_GAP_MS = 1300; // sans trop attendre entre deux (heure du geste, pas de son traitement)

type Click = { x: number; y: number; pt: Point; t: number };

/**
 * L'Envers : cinq clics de suite au même endroit de la carte, et si c'est
 * le bon endroit, la feuille se déchire. Le navigateur ne connaît pas
 * l'endroit : il demande seulement au serveur « ici ? ».
 */
export function useEnvers(enabled: boolean, wantsAdminOpen: boolean, onTear?: () => void) {
  const supabase = createClient();
  const { showToast } = useToast();
  const clicks = useRef<Click[]>([]);
  const probing = useRef(false);
  const [tear, setTear] = useState<{ x: number; y: number } | null>(null);
  const [panel, setPanel] = useState<{ first: boolean } | null>(null);
  const [picking, setPicking] = useState(false);
  const pendingFirst = useRef(false);
  const onTearRef = useRef(onTear);
  onTearRef.current = onTear;

  const openAt = useCallback((x: number, y: number, first: boolean) => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {}
    pendingFirst.current = first;
    onTearRef.current?.();
    setPanel(null);
    setTear({ x, y });
  }, []);

  // Ceux qui ont déjà trouvé L'Envers : on fait avancer leur séjour en silence.
  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1';
    } catch {}
    if (seen) supabase.rpc('envers_ping').then(() => undefined);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accès direct réservé à l'administration (?envers=1).
  useEffect(() => {
    if (!enabled || !wantsAdminOpen) return;
    supabase.rpc('envers_state').then(({ data }) => {
      const s = data as { access?: boolean; is_admin?: boolean } | null;
      if (s?.access && s.is_admin) openAt(window.innerWidth / 2, window.innerHeight / 2, false);
    });
  }, [enabled, wantsAdminOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const countClick = useCallback(
    (x: number, y: number, pt: Point, at: number) => {
      const now = at;
      const list = clicks.current;
      const last = list[list.length - 1];
      if (!last || now - last.t > MAX_GAP_MS || Math.hypot(x - list[0].x, y - list[0].y) > SAME_SPOT_PX) clicks.current = [];
      clicks.current.push({ x, y, pt, t: now });

      if (clicks.current.length >= CLICKS && !probing.current) {
        const batch = clicks.current;
        clicks.current = [];
        const mx = batch.reduce((s, c) => s + c.pt.x, 0) / batch.length;
        const my = batch.reduce((s, c) => s + c.pt.y, 0) / batch.length;
        probing.current = true;
        supabase
          .rpc('envers_probe', { p_x: Math.round(mx * 1000) / 1000, p_y: Math.round(my * 1000) / 1000 })
          .then(({ data }) => {
            probing.current = false;
            const r = data as { ok?: boolean; first?: boolean } | null;
            if (r?.ok) openAt(x, y, !!r.first);
          });
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Le premier clic sur une région ou un lieu ouvre sa fiche (en bas sur
  // téléphone, à droite sur ordinateur) : les clics suivants tombent alors
  // dessus. Tant qu'une série est en cours, un clic au même endroit sur une
  // de ces fenêtres compte quand même pour la carte, et n'appuie sur rien.
  useEffect(() => {
    if (!enabled) return;
    let swallow: { x: number; y: number; until: number } | null = null;
    const near = (e: MouseEvent, q: { x: number; y: number }) => Math.hypot(e.clientX - q.x, e.clientY - q.y) <= SAME_SPOT_PX;
    const onUp = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || target.closest('[data-envers-map]') || target.closest('.envers-panel')) return;
      const list = clicks.current;
      const last = list[list.length - 1];
      if (!last || e.timeStamp - last.t > MAX_GAP_MS || !near(e, list[0])) return;
      swallow = { x: e.clientX, y: e.clientY, until: performance.now() + 600 };
      e.preventDefault();
      e.stopPropagation();
      countClick(e.clientX, e.clientY, last.pt, e.timeStamp);
    };
    const onClick = (e: MouseEvent) => {
      if (swallow && performance.now() < swallow.until && near(e, swallow)) {
        e.preventDefault();
        e.stopPropagation();
        swallow = null;
      }
    };
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('click', onClick, true);
    };
  }, [enabled, countClick]);

  /** À appeler pour chaque simple clic sur la carte. Renvoie true si le clic a été consommé. */
  const onMapClick = useCallback(
    (x: number, y: number, pt: Point, at: number = performance.now()): boolean => {
      if (!enabled) return false;
      if (picking) {
        setPicking(false);
        supabase
          .rpc('envers_admin_set_config', { p_x: Math.round(pt.x * 100) / 100, p_y: Math.round(pt.y * 100) / 100 })
          .then(({ data, error }) => {
            if (error || (data as { error?: string } | null)?.error) return showToast('Impossible de déplacer la faille.', 'error');
            showToast('La faille est maintenant ici.', 'success');
            setPanel({ first: false });
          });
        return true;
      }
      countClick(x, y, pt, at);
      return false;
    },
    [enabled, picking, countClick] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const layer = (
    <>
      {tear && (
        <EnversTear
          origin={tear}
          onOpened={() => {
            setPanel({ first: pendingFirst.current });
            // On laisse la déchirure un instant sous le panneau, le temps qu'il apparaisse.
            setTimeout(() => setTear(null), 400);
          }}
        />
      )}
      {panel && (
        <EnversPanel
          first={panel.first}
          onClose={() => setPanel(null)}
          onPickSpot={() => {
            setPanel(null);
            setPicking(true);
          }}
        />
      )}
      {picking && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[#c9d3e6]/30 bg-[#0d0b18]/90 px-4 py-2 text-sm text-[#dfe6f2] shadow-xl">
            <span>Clique là où la carte doit céder.</span>
            <button onClick={() => setPicking(false)} className="text-xs text-[#9aa6c4] underline">
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );

  return { onMapClick, layer, picking };
}
