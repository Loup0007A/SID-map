import type { Metadata } from 'next';
import { Privacy } from '@/components/legal/LegalContent';
import LegalPage from '@/components/legal/LegalPage';
import { getBrand } from '@/lib/brand-server';

export const metadata: Metadata = { title: 'Confidentialité' };

export default async function PrivacyPage() {
  await getBrand();
  return (
    <LegalPage title="Confidentialité">
      <Privacy site="map" />
    </LegalPage>
  );
}
