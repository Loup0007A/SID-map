'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/client';

/**
 * Carnet de voyage (Lot 97, migration 0122) : les étapes du membre, les
 * lieux qu'il a parcourus et ses notes. Lu par carnet() ; les notes sont
 * dans carnet_notes (chacun ne voit et n'écrit que les siennes).
 */

type Lieu = { id: string; name: string; type: string | null };
type Etape = { id: number; date: string; lieu: Lieu; depuis: { id: string; name: string } | null };
type LieuParcouru = Lieu & { premiere: string; decouvert_par_moi: boolean; passages: number; note: string | null; note_at: string | null };
type Donnees = {
  chiffres: { lieux: number; lieux_total: number; decouvertes: number; etapes: number; km: number; depuis: string | null };
  etapes: Etape[];
  lieux: LieuParcouru[];
};

const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function NoteLieu({ lieu, uid, onSaved }: { lieu: LieuParcouru; uid: string; onSaved: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState(lieu.note ?? '');
  const [etat, setEtat] = useState<string | null>(null);

  async function enregistrer() {
    setEtat(null);
    const t = texte.trim();
    const { error } = t
      ? await supabase.from('carnet_notes').upsert({ user_id: uid, place_id: lieu.id, note: t, updated_at: new Date().toISOString() })
      : await supabase.from('carnet_notes').delete().eq('user_id', uid).eq('place_id', lieu.id);
    if (error) return setEtat(`Échec : ${error.message}`);
    setOuvert(false);
    onSaved();
  }

  if (!ouvert) {
    return (
      <div className="space-y-1">
        {lieu.note && <p className="carnet-note whitespace-pre-wrap font-serif">{lieu.note}</p>}
        <button onClick={() => setOuvert(true)} className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
          {lieu.note ? 'Modifier la note' : 'Écrire une note'}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={3}
        maxLength={2000}
        autoFocus
        className="glass-input w-full rounded-lg px-3 py-2 text-sm"
        aria-label={`Note sur ${lieu.name}`}
        placeholder="Ce que tu veux retenir de ce lieu (visible par toi seul)"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={enregistrer} className="btn-accent rounded-lg px-3 py-1.5 text-sm">
          {texte.trim() ? 'Enregistrer' : lieu.note ? 'Effacer la note' : 'Fermer'}
        </button>
        <button
          onClick={() => {
            setTexte(lieu.note ?? '');
            setOuvert(false);
          }}
          className="btn-ghost rounded-lg px-3 py-1.5 text-sm"
        >
          Annuler
        </button>
        <span className="text-xs opacity-80">{texte.length} / 2000</span>
        {etat && <span className="text-sm text-[rgb(var(--danger,190_40_40))]">{etat}</span>}
      </div>
    </div>
  );
}

export default function Carnet() {
  const supabase = useMemo(() => createClient(), []);
  const [d, setD] = useState<Donnees | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<'etapes' | 'lieux'>('etapes');
  const [filtre, setFiltre] = useState('');

  const load = useCallback(async () => {
    const [{ data, error: e }, { data: u }] = await Promise.all([supabase.rpc('carnet'), supabase.auth.getUser()]);
    setUid(u.user?.id ?? null);
    if (e) return setError(/carnet|PGRST202/.test(`${e.message} ${e.code}`) ? 'Le carnet de voyage arrive avec la migration 0122.' : e.message);
    setError(null);
    setD(data as Donnees);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const parJour = useMemo(() => {
    const m = new Map<string, Etape[]>();
    for (const e of d?.etapes ?? []) {
      const k = new Date(e.date).toDateString();
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.values()];
  }, [d]);

  const lieux = useMemo(() => {
    const q = sansAccents(filtre.trim());
    return (d?.lieux ?? []).filter((l) => !q || sansAccents(`${l.name} ${l.type ?? ''} ${l.note ?? ''}`).includes(q));
  }, [d, filtre]);

  const c = d?.chiffres;
  const pct = c && c.lieux_total ? Math.round((c.lieux / c.lieux_total) * 100) : 0;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-5 md:px-8">
        <Link href="/carte" className="back-link">
          ← Carte du monde
        </Link>

        <header className="vellum mt-4 space-y-4 rounded-2xl p-4 md:p-5">
          <div>
            <p className="section-label">Pour toi seul</p>
            <h1 className="interior-title">Carnet de voyage</h1>
          </div>
          {c && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dd className="font-display text-2xl">
                  {c.lieux}
                  <span className="text-base opacity-80"> / {c.lieux_total}</span>
                </dd>
                <dt className="text-sm opacity-85">lieux parcourus ({pct} %)</dt>
              </div>
              <div>
                <dd className="font-display text-2xl">{c.decouvertes}</dd>
                <dt className="text-sm opacity-85">découverte{c.decouvertes > 1 ? 's' : ''} à ton nom</dt>
              </div>
              <div>
                <dd className="font-display text-2xl">{Math.round(c.km).toLocaleString('fr-FR')} km</dd>
                <dt className="text-sm opacity-85">parcourus en trajet</dt>
              </div>
              <div>
                <dd className="font-display text-2xl">{c.etapes}</dd>
                <dt className="text-sm opacity-85">étape{c.etapes > 1 ? 's' : ''}{c.depuis ? ` depuis le ${date(c.depuis)}` : ''}</dt>
              </div>
            </dl>
          )}
          {c && c.lieux_total > 0 && (
            <div className="carnet-barre" role="progressbar" aria-valuemin={0} aria-valuemax={c.lieux_total} aria-valuenow={c.lieux} aria-label="Lieux parcourus">
              <span style={{ width: `${pct}%` }} />
            </div>
          )}
        </header>

        {error && <p className="vellum mt-4 rounded-xl p-4">{error}</p>}
        {!d && !error && <p className="py-10 text-center opacity-80">Chargement du carnet…</p>}

        {d && (
          <>
            <div role="tablist" aria-label="Carnet" className="mt-5 flex gap-2">
              {(
                [
                  ['etapes', `Étapes (${d.etapes.length})`],
                  ['lieux', `Lieux parcourus (${d.lieux.length})`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={onglet === k}
                  onClick={() => setOnglet(k)}
                  className={`rounded-lg px-4 py-2 font-display text-[0.95rem] ${onglet === k ? 'btn-accent' : 'btn-ghost'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {onglet === 'etapes' && (
              <div role="tabpanel" className="mt-4 space-y-5">
                {parJour.length === 0 && (
                  <p className="vellum rounded-xl p-4">
                    Pas encore d&apos;étape. Chaque arrivée dans un lieu s&apos;inscrit ici à partir de maintenant ; les lieux déjà parcourus sont dans l&apos;onglet « Lieux parcourus ».
                  </p>
                )}
                {parJour.map((list) => (
                  <section key={list[0].id} className="space-y-2">
                    <h2 className="section-label">{jour(list[0].date)}</h2>
                    <ol className="carnet-frise space-y-2">
                      {list.map((e) => (
                        <li key={e.id} className="vellum rounded-xl px-4 py-3">
                          <p>
                            <span className="font-mono text-sm opacity-85">{heure(e.date)}</span>{' '}
                            Arrivée à{' '}
                            <Link href={`/carte?lieu=${e.lieu.id}`} className="font-semibold underline-offset-2 hover:underline">
                              {e.lieu.name}
                            </Link>
                            {e.depuis && (
                              <span className="opacity-85">
                                {' '}
                                depuis{' '}
                                <Link href={`/carte?lieu=${e.depuis.id}`} className="underline-offset-2 hover:underline">
                                  {e.depuis.name}
                                </Link>
                              </span>
                            )}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}

            {onglet === 'lieux' && (
              <div role="tabpanel" className="mt-4 space-y-3">
                {d.lieux.length > 6 && (
                  <input
                    value={filtre}
                    onChange={(e) => setFiltre(e.target.value)}
                    placeholder="Chercher un lieu ou une note"
                    aria-label="Chercher un lieu ou une note"
                    className="glass-input w-full rounded-lg px-3 py-2 text-sm"
                  />
                )}
                {d.lieux.length === 0 && <p className="vellum rounded-xl p-4">Tu n&apos;as encore parcouru aucun lieu. Pars de la carte du monde.</p>}
                {d.lieux.length > 0 && lieux.length === 0 && <p className="opacity-85">Aucun lieu ne correspond.</p>}
                <ul className="space-y-3">
                  {lieux.map((l) => (
                    <li key={l.id} className="vellum space-y-2 rounded-xl px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link href={`/carte?lieu=${l.id}`} className="font-display text-lg underline-offset-2 hover:underline">
                          {l.name}
                        </Link>
                        {l.decouvert_par_moi && <span className="tag-own text-xs">Découvert par toi</span>}
                      </div>
                      <p className="text-sm opacity-85">
                        {l.type ? `${l.type.charAt(0).toUpperCase()}${l.type.slice(1)} · ` : ''}
                        Première visite le {date(l.premiere)}
                        {l.passages > 0 ? ` · ${l.passages} passage${l.passages > 1 ? 's' : ''} noté${l.passages > 1 ? 's' : ''}` : ''}
                      </p>
                      {uid && <NoteLieu lieu={l} uid={uid} onSaved={load} />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
