import CityMap from '@/components/city/CityMap';

export default async function VillePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <CityMap cityId={params.id} />;
}
