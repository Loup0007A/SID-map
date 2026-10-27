import type { Metadata, Viewport } from 'next';
// Polices servies par le site lui-même (paquets @fontsource).
import { LabelLinker } from '@/components/a11y/LabelLinker';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/alegreya-sans/400-italic.css';
import '@fontsource/alegreya-sc/500.css';
import '@fontsource/alegreya-sc/700.css';
import '@fontsource/alegreya/500.css';
import '@fontsource/alegreya/700.css';
import '@fontsource/alegreya/500-italic.css';
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
  themeColor: '#121927',
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
        <LabelLinker />
      </body>
    </html>
  );
}
