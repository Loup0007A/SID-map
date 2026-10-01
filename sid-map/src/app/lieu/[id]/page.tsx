import PlaceBuildingClient from '@/components/building/PlaceBuildingClient';

export default function LieuPage({ params }: { params: { id: string } }) {
  return <PlaceBuildingClient placeId={params.id} />;
}
