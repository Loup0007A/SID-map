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
import './fonds.css';
import Backdrop from '@/components/Backdrop';
import { BrandProvider } from '@/components/BrandProvider';
import SiteGate from '@/components/SiteGate';
import { brandify } from '@/lib/brand';
import { getBrand, getFondTheme, getGlitched } from '@/lib/brand-server';
import { GlitchSync } from '@/components/glitch/GlitchSync';
import ComfortSync from '@/components/ComfortSync';
import { COMFORT_BOOT } from '@/lib/comfortPrefs';


// Noms tirés de app_config (Lot 77, voir SETUP.md du site principal).
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return {
    title: { default: `${b.name} — ${b.map}`, template: `%s · ${b.name} ${b.map}` },
    description: brandify('Cartographie du monde — S.I.D.'),
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: brandify('S.I.D. Carte') },
    icons: {
      icon: [
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
      ],
      apple: '/apple-touch-icon.png'
    }
  };
}

export const viewport: Viewport = {
  themeColor: '#2A1408',
  viewportFit: 'cover'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [brand, glitched, theme] = await Promise.all([getBrand(), getGlitched(), getFondTheme()]);
  return (
    <html lang="fr" data-theme={theme ?? undefined} suppressHydrationWarning>
      <head>
        {/* Réglages d'affichage du compte (Lot 94) : posés avant le premier affichage. */}
        <script dangerouslySetInnerHTML={{ __html: COMFORT_BOOT }} />
      </head>
      <body className="text-paper font-body antialiased">
        <Backdrop />
        <BrandProvider brand={brand} glitched={glitched}>
          <SiteGate>
            <ToastProvider>
              <GuideProvider>{children}</GuideProvider>
            </ToastProvider>
          </SiteGate>
          <SessionGuard />
          <TermsBanner />
          <EventDecor variant="map" />
          <LabelLinker />
          <GlitchSync />
          <ComfortSync />
        </BrandProvider>
      </body>
    </html>
  );
}
