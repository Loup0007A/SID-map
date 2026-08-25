import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carte du Monde — S.I.D.',
  description: "Carte interactive du monde RP de S.I.D."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-ink text-parchment font-body antialiased">{children}</body>
    </html>
  );
}
