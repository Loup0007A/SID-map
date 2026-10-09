'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const KINDS = [
  { id: 'erreur', label: '❌ Une erreur' },
  { id: 'manque', label: '❓ Une info manquante' },
  { id: 'idee', label: '💡 Une idée' },
  { id: 'autre', label: '💬 Autre' },
] as const;

/** « Signaler » : envoie un message aux admins (boîte de réception du Dashboard). */
export default function ReportButton({ category, number }: { category: string; number: number }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('erreur');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc('wiki_report_add', { p_category: category, p_number: number, p_kind: kind, p_body: body });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
    setBody('');
    setOpen(false);
  }

  if (sent) return <span className="no-print text-sm font-bold text-olive-700">✅ Merci ! Les admins ont reçu ton message.</span>;

  return (
    <div className="no-print">
      <button type="button" className="text-sm text-olive-700 underline-offset-2 hover:underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        🚩 Signaler un problème sur cette fiche
      </button>
      {open && (
        <div className="card mt-2 max-w-md p-3">
          <p className="mb-2 text-sm text-olive-800">Tu as repéré quelque chose sur cette fiche ?</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)} className={kind === k.id ? 'btn !px-3 !py-0.5 text-sm' : 'btn-ghost !px-3 !py-0.5 text-sm'}>
                {k.label}
              </button>
            ))}
          </div>
          <textarea className="input min-h-[5rem]" maxLength={1000} placeholder="Explique en quelques mots…" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" className="btn" disabled={busy || body.trim().length < 3} onClick={send}>
              {busy ? 'Envoi…' : 'Envoyer aux admins'}
            </button>
            {error && <span className="text-sm text-stamp">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
