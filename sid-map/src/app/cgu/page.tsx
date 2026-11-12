import type { Metadata } from 'next';
import { Cgu } from '@/components/legal/LegalContent';
import LegalPage from '@/components/legal/LegalPage';
import { getBrand } from '@/lib/brand-server';

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default async function CguPage() {
  await getBrand();
  return (
    <LegalPage title="Conditions d'utilisation">
      <Cgu site="map" />
    </LegalPage>
  );
}
