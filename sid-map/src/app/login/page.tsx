'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Identifiants refusés. Ce sont les mêmes que sur le dossier principal de la S.I.D.');
      setLoading(false);
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      if (profile && profile.status !== 'active') {
        setError(`Dossier non actif (statut : ${profile.status}).`);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
    }

    router.push(params.get('next') || '/carte');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="stamp-bar mb-0 h-1.5 w-full" />
        <form
          onSubmit={handleSubmit}
          className="dossier-corner space-y-5 border border-white/10 bg-panel p-8"
        >
          <div className="space-y-1 text-center">
            <p className="font-display text-[10px] uppercase tracking-widest2 text-accent">
              S.I.D. — Cartographie
            </p>
            <h1 className="font-display text-xl uppercase tracking-wide text-paper">
              Accès au dossier
            </h1>
          </div>

          <div className="space-y-1">
            <label className="font-display text-[10px] uppercase tracking-wide text-paper/50">
              Identifiant (email)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-white/15 bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="font-display text-[10px] uppercase tracking-wide text-paper/50">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-white/15 bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-xs text-accent">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent py-2 font-display text-xs uppercase tracking-widest2 text-paper transition hover:bg-accent2 disabled:opacity-50"
          >
            {loading ? 'Vérification…' : 'Entrer'}
          </button>

          <p className="text-center text-[11px] text-paper/40">
            Utilise le même dossier que sur le site principal S.I.D.
          </p>
        </form>
      </div>
    </main>
  );
}
