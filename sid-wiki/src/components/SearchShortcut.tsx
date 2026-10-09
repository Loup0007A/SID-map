'use client';

import { useEffect } from 'react';

/** Appuie sur « / » n'importe où pour aller dans la barre de recherche. */
export default function SearchShortcut() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const input = document.getElementById('global-search') as HTMLInputElement | null;
      if (input) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
