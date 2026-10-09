'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError('Identifiants invalides.');
      setLoading(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  const applyUrl = process.env.NEXT_PUBLIC_DOSSIER_CENTRAL_URL;

  return (
    <div className="mx-auto mt-6 max-w-sm sm:mt-16">
      <div className="card p-6">
        <span className="stamp">Chasseurs uniquement !</span>
        <h1 className="title-grad mb-1 mt-3 font-typewriter text-2xl font-bold text-olive-800">
          Wiki du S.I.D.
        </h1>
        <p className="mb-5 text-sm text-olive-700">Connecte-toi avec ton compte de chasseur (celui du Dossier Central).</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-stamp">{error}</p>}
          <button className="btn w-full" disabled={loading}>
            {loading ? 'Connexion…' : 'En chasse !'}
          </button>
        </form>

        {applyUrl && (
          <p className="mt-4 text-center text-sm">
            <a href={applyUrl} className="underline">Pas encore de compte ? Rejoins la chasse !</a>
          </p>
        )}
      </div>
    </div>
  );
}
