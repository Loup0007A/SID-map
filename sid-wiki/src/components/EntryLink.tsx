'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pad } from '@/lib/wiki';

type Preview =
  | { exists: false }
  | { exists: true; discovered: false }
  | { exists: true; discovered: true; title: string; summary: string; image_url: string | null };

// Cache partagé pour éviter de redemander un aperçu déjà chargé.
const cache = new Map<string, Preview>();

export default function EntryLink({
  category,
  number,
  children,
}: {
  category: string;
  number: number;
  children: React.ReactNode;
}) {
  const key = `${category}/${number}`;
  const [preview, setPreview] = useState<Preview | null>(cache.get(key) ?? null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tip = useRef<HTMLSpanElement | null>(null);
  const [shift, setShift] = useState(0);

  // Décale l'infobulle pour qu'elle ne dépasse jamais de l'écran (téléphone)
  useLayoutEffect(() => {
    if (!open || !tip.current) return;
    const r = tip.current.getBoundingClientRect();
    const margin = 8;
    const base = r.left - shift;
    let next = 0;
    if (base + r.width > window.innerWidth - margin) next = window.innerWidth - margin - (base + r.width);
    if (base + next < margin) next = margin - base;
    if (next !== shift) setShift(next);
  }, [open, preview, shift]);

  async function load() {
    if (cache.has(key)) {
      setPreview(cache.get(key)!);
      return;
    }
    const { data, error } = await createClient().rpc('wiki_preview', {
      p_category: category,
      p_number: number,
    });
    if (error || !data) return;
    cache.set(key, data as Preview);
    setPreview(data as Preview);
  }

  function show() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(true);
      load();
    }, 200);
  }

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  }

  return (
    <span className="relative" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <Link href={`/${category}/${pad(number)}`} className="wiki-link wiki-link-entry">
        {children}
      </Link>

      {open && (
        <span
          role="tooltip"
          ref={tip}
          style={{ transform: `translateX(${shift}px)` }}
          className="absolute left-0 top-full z-50 mt-1 block w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-white/25 bg-[#0b1730] p-3 text-left text-sm font-normal not-italic leading-snug text-ink no-underline shadow-2xl shadow-black/60 ring-1 ring-black/40"
        >
          {!preview && <span className="italic text-olive-700">Chargement…</span>}
          {preview && !preview.exists && <span className="italic">Fiche inexistante.</span>}
          {preview && preview.exists && !preview.discovered && (
            <span className="block">
              <span className="block font-typewriter text-xs text-olive-700">
                {category} · {pad(number)}
              </span>
              <span className="block text-2xl font-bold text-stamp">?</span>
              <span className="italic">À découvrir !</span>
            </span>
          )}
          {preview && preview.exists && preview.discovered && (
            <span className="flex gap-3">
              {preview.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.image_url} alt="" className="h-16 w-16 flex-none rounded border border-olive-800/40 object-cover" />
              )}
              <span className="block min-w-0">
                <span className="block font-typewriter text-xs text-olive-700">
                  {category} · {pad(number)}
                </span>
                <span className="block font-bold">{preview.title}</span>
                {preview.summary && <span className="line-clamp-3 block text-xs">{preview.summary}</span>}
              </span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
