import type { Metadata, Viewport } from 'next';
// Polices servies par le site lui-même (paquets @fontsource).
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import { ToastProvider } from '@/components/ui/Toast';
import TermsBanner from '@/components/legal/TermsBanner';
import { GuideProvider } from '@/components/guide/GuideProvider';
import EventDecor from '@/components/EventDecor';
import SessionGuard from '@/components/auth/SessionGuard';
import './globals.css';


export const metadata: Metadata = {
  title: 'S.I.D. — Cartographie',
  description: 'Cartographie du monde — S.I.D.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'S.I.D. Carte' },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/apple-touch-icon.png'
  }
};

export const viewport: Viewport = {
  themeColor: '#070c18',
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-ink text-paper font-body antialiased">
        <ToastProvider>
          <GuideProvider>{children}</GuideProvider>
        </ToastProvider>
        <SessionGuard />
        <TermsBanner />
        <EventDecor variant="map" />
      </body>
    </html>
  );
}
