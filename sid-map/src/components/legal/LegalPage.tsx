import Link from 'next/link';

/** Mise en page des pages publiques (CGU, confidentialité) : lisibles sans être connecté. */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen overflow-y-auto px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link href="/carte" className="font-display text-[11px] uppercase tracking-widest2 text-accent">
          ← S.I.D. — Cartographie
        </Link>
        <div className="glass-strong overflow-hidden rounded-2xl">
          <div className="stamp-bar h-1.5 w-full" />
          <div className="space-y-2 p-6 md:p-8">
            <h1 className="font-display text-xl uppercase tracking-wide text-paper">{title}</h1>
            {children}
          </div>
        </div>
        <LegalLinks />
      </div>
    </main>
  );
}

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wide text-paper/40 ${className}`}>
      <Link href="/cgu" className="hover:text-accent hover:underline">Conditions d&apos;utilisation</Link>
      <Link href="/confidentialite" className="hover:text-accent hover:underline">Confidentialité</Link>
      <a href="https://sid-quest.vercel.app/dashboard/privacy" className="hover:text-accent hover:underline">Mes données</a>
    </p>
  );
}
