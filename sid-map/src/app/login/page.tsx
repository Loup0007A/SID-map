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
      setError("Identifiants invalides. Ce sont les mêmes que sur le site principal de S.I.D.");
      setLoading(false);
      return;
    }

    // Le statut du profil (pending/active/rejected/banned) est
    // re-vérifié comme sur le premier site avant d'autoriser l'accès.
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
        setError("Ton compte n'est pas encore actif sur S.I.D. (statut: " + profile.status + ").");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
    }

    router.push(params.get('next') || '/carte');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-gold/30 bg-black/30 p-8 backdrop-blur"
      >
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl text-gold">Carte du Monde</h1>
          <p className="text-sm text-parchment/60">
            Connecte-toi avec ton compte S.I.D.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-parchment/60">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-parchment/20 bg-black/40 px-3 py-2 outline-none focus:border-gold"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-parchment/60">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-parchment/20 bg-black/40 px-3 py-2 outline-none focus:border-gold"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gold py-2 font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  );
}
