import CityMap from '@/components/city/CityMap';

export default function VillePage({ params }: { params: { id: string } }) {
  return <CityMap cityId={params.id} />;
}
