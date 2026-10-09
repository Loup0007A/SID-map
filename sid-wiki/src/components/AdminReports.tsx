'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pad, type Category } from '@/lib/wiki';
import Icon from './Icon';

export type Report = {
  id: string;
  category: Category;
  number: number;
  title: string;
  kind: 'erreur' | 'manque' | 'idee' | 'autre';
  body: string;
  status: 'open' | 'done';
  author: string;
  created_at: string;
  resolved_at: string | null;
};

const KIND: Record<Report['kind'], string> = { erreur: '❌ Erreur', manque: '❓ Info manquante', idee: '💡 Idée', autre: '💬 Autre' };

/** Boîte de réception des signalements envoyés par les membres. */
export default function AdminReports({ reports, onChange }: { reports: Report[]; onChange: () => void }) {
  const supabase = createClient();
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(r: Report, status: 'open' | 'done') {
    const { error } = await supabase
      .from('wiki_reports')
      .update({ status, resolved_at: status === 'done' ? new Date().toISOString() : null })
      .eq('id', r.id);
    if (error) return setError(error.message);
    setError(null);
    onChange();
  }

  async function remove(r: Report) {
    if (!confirm('Supprimer ce signalement ?')) return;
    const { error } = await supabase.from('wiki_reports').delete().eq('id', r.id);
    if (error) return setError(error.message);
    onChange();
  }

  const open = reports.filter((r) => r.status === 'open');
  const done = reports.filter((r) => r.status === 'done');
  const list = showDone ? [...open, ...done] : open;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="font-typewriter font-bold">{open.length} à traiter</span>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Afficher aussi les {done.length} traités
        </label>
      </div>
      {error && <p className="mb-3 text-stamp">{error}</p>}
      {list.length === 0 ? (
        <p className="card p-5 italic text-olive-700">Boîte vide : bravo ! 🎉</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className={`card p-4 ${r.status === 'done' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-bold">{KIND[r.kind]}</span>
                <Link href={`/${r.category}/${pad(r.number)}`} className="font-bold text-olive-700 hover:underline">
                  <Icon name={r.category} /> {r.title} · N° {pad(r.number)}
                </Link>
                <span className="text-olive-700">
                  par @{r.author} · {new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line">{r.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/edit/${r.category}/${pad(r.number)}`} className="btn-ghost !px-3 !py-0.5">
                  Éditer la fiche
                </Link>
                {r.status === 'open' ? (
                  <button className="btn !px-3 !py-0.5" onClick={() => setStatus(r, 'done')}>
                    ✅ Marquer traité
                  </button>
                ) : (
                  <button className="btn-ghost !px-3 !py-0.5" onClick={() => setStatus(r, 'open')}>
                    Rouvrir
                  </button>
                )}
                <button className="btn-danger !px-3 !py-0.5" onClick={() => remove(r)}>
                  Suppr.
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
