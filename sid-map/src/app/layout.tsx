import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  title: 'S.I.D. — Cartographie',
  description: 'Cartographie du monde — S.I.D.'
};

export const viewport: Viewport = {
  themeColor: '#1b1e27',
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-ink text-paper font-body antialiased">{children}</body>
    </html>
  );
}
