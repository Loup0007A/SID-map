import type { Metadata } from 'next';
import { Cgu } from '@/components/legal/LegalContent';
import LegalPage from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: "Conditions d'utilisation · S.I.D. Cartographie" };

export default function CguPage() {
  return (
    <LegalPage title="Conditions d'utilisation">
      <Cgu site="map" />
    </LegalPage>
  );
}
