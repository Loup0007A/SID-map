import BuildingClient from '@/components/building/BuildingClient';

export default async function BatimentPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <BuildingClient buildingId={params.id} />;
}
