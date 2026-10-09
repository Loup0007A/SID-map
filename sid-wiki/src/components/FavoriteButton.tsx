'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function FavoriteButton({ category, number, initial }: { category: string; number: number; initial: boolean }) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const { data, error } = await createClient().rpc('wiki_favorite_toggle', { p_category: category, p_number: number });
    setBusy(false);
    if (!error) setFav(data === true);
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} className="btn-ghost" aria-pressed={fav}>
      {fav ? '⭐ Favori' : '☆ Favori'}
    </button>
  );
}
