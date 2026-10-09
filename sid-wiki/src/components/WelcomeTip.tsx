'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'wiki-welcome-seen';

/** Petit bandeau à la toute première visite : renvoie vers le mini-guide. */
export default function WelcomeTip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {}
  }, []);

  function close() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-3">
      <span className="text-sm">👋 Première visite ? Le mini-guide t’explique tout en 1 minute.</span>
      <span className="ml-auto flex gap-2">
        <Link href="/aide" className="btn !px-3 !py-1 text-sm" onClick={close}>
          Voir le guide
        </Link>
        <button type="button" className="btn-ghost !px-3 !py-1 text-sm" onClick={close}>
          Plus tard
        </button>
      </span>
    </div>
  );
}
