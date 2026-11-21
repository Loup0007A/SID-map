import Link from 'next/link';
import { BRAND } from '@/lib/brand';

/** Mise en page des pages publiques (CGU, confidentialité) : lisibles sans être connecté. */
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen overflow-y-auto px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link href="/carte" className="back-link text-sm">
          ← S.I.D. — Cartographie
        </Link>
        <div className="vellum overflow-hidden rounded-2xl">
          <div className="space-y-2 p-6 md:p-8">
            <h1 className="interior-title text-[1.8rem]">{title}</h1>
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
    <p className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] font-semibold uppercase tracking-wide text-paper ${className}`}>
      <Link href="/cgu" className="hover:text-accent hover:underline">Conditions d&apos;utilisation</Link>
      <Link href="/confidentialite" className="hover:text-accent hover:underline">Confidentialité</Link>
      <a href={`${BRAND.urls.site}/dashboard/privacy`} className="hover:text-accent hover:underline">Mes données</a>
    </p>
  );
}
