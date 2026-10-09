'use client';

import { useState } from 'react';

/** Barre de recherche de l'en-tête (ordinateur) : loupe, champ large, pastille « / ». */
export default function SearchBox() {
  const [focused, setFocused] = useState(false);
  const [value, setValue] = useState('');

  return (
    <form action="/recherche" role="search" className="group relative w-full">
      <svg
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-olive-700 transition group-focus-within:text-brass-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id="global-search"
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Rechercher dans le wiki…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="h-11 w-full rounded-full border border-white/20 bg-white/[0.08] pl-11 pr-14 font-body text-base text-ink shadow-inner outline-none backdrop-blur transition placeholder:text-olive-600/60 focus:border-kraft-400 focus:bg-white/[0.12] focus:ring-2 focus:ring-kraft-400/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {!focused && !value && (
        <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-white/25 bg-white/10 px-2 py-0.5 font-typewriter text-xs font-bold text-olive-800">
          /
        </kbd>
      )}
    </form>
  );
}
