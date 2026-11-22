import PlaceBuildingClient from '@/components/building/PlaceBuildingClient';

export default async function LieuPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <PlaceBuildingClient placeId={params.id} />;
}
